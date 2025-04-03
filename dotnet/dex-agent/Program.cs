using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Integration.AspNet.Core;
using Microsoft.Bot.Connector.Authentication;
using Microsoft.Teams.AI;
using Microsoft.SemanticKernel;
using DexAgent.Interfaces;
using DexAgent;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient("WebClient", client => client.Timeout = TimeSpan.FromSeconds(600));
builder.Services.AddHttpContextAccessor();
builder.Logging.AddConsole();

// Prepare Configuration for ConfigurationBotFrameworkAuthentication
var config = builder.Configuration.Get<ConfigOptions>();
builder.Configuration["MicrosoftAppType"] = "MultiTenant";
builder.Configuration["MicrosoftAppId"] = config.BOT_ID;
builder.Configuration["MicrosoftAppPassword"] = config.BOT_PASSWORD;

// Create the Bot Framework Authentication to be used with the Bot Adapter.
builder.Services.AddSingleton<BotFrameworkAuthentication, ConfigurationBotFrameworkAuthentication>();

// Create the Cloud Adapter with error handling enabled.
// Note: some classes expect a BotAdapter and some expect a BotFrameworkHttpAdapter, so
// register the same adapter instance for both types.
builder.Services.AddSingleton<TeamsAdapter, AdapterWithErrorHandler>();
builder.Services.AddSingleton<IBotFrameworkHttpAdapter>(sp => sp.GetService<TeamsAdapter>());

// Create the storage to persist turn state
builder.Services.AddSingleton<IStorage, MemoryStorage>();

// Create the repository service and plugin
builder.Services.AddTransient<IRepositoryService>(sp =>
{
    MemoryStorage storage = (MemoryStorage)sp.GetService<IStorage>();
    TeamsAdapter adapter = sp.GetService<TeamsAdapter>();
    HttpClient client = sp.GetService<HttpClient>();

    GitHubPlugin plugin = new(client, config);
    return new GitHubService(storage, adapter, plugin);
});

// Create semantic kernel 
builder.Services.AddTransient(sp =>
{
    var kernelBuilder = Kernel.CreateBuilder();
    kernelBuilder.Services.AddLogging(services => services.AddConsole().SetMinimumLevel(LogLevel.Debug));

    HttpClient client = sp.GetService<HttpClient>();
    IRepositoryService repoService = sp.GetService<IRepositoryService>();

    kernelBuilder.AddAzureOpenAIChatCompletion(
        deploymentName: config.Azure.OpenAIDeploymentName,
        modelId: config.Azure.OpenAIModelId,
        apiKey: config.Azure.OpenAIApiKey,
        endpoint: config.Azure.OpenAIEndpoint,
        httpClient: client);

    GitHubPlugin plugin = (GitHubPlugin)repoService.RepositoryPlugin;
    kernelBuilder.Plugins.AddFromObject(plugin, "GitHubPlugin");
    return kernelBuilder.Build();
});

// Create the bot as a transient. In this case the ASP Controller is expecting an IBot.
builder.Services.AddTransient<IBot>(sp =>
{
    ILoggerFactory loggerFactory = sp.GetService<ILoggerFactory>()!;
    HttpClient client = sp.GetService<HttpClient>();
    IStorage storage = sp.GetService<IStorage>();
    TeamsAdapter adapter = sp.GetService<TeamsAdapter>();

    AppState state = new AppState();
    AuthenticationOptions<AppState> options = new();
    options.AddAuthentication(config.OAUTH_CONNECTION_NAME, new OAuthSettings()
    {
        ConnectionName = config.OAUTH_CONNECTION_NAME,
        Title = "Sign In",
        Text = "Please sign in to use the bot.",
        EndOnInvalidMessage = true
    }
    );

    Application<AppState> app = new ApplicationBuilder<AppState>()
        .WithStorage(storage)
        .WithTurnStateFactory(() => state)
        .WithAuthentication(adapter, options)
        .WithLoggerFactory(loggerFactory)
        .Build();

    // Setup orchestration
    Kernel kernel = sp.GetService<Kernel>();
    KernelOrchestrator orchestrator = new KernelOrchestrator(kernel, storage, config);

    DexBot bot = new(app, config, kernel, orchestrator);
    return app;
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseStaticFiles();
app.UseRouting();
app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
});

app.Run();
