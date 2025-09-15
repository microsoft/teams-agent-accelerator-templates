using Microsoft.Teams.Plugins.AspNetCore.DevTools.Extensions;
using Microsoft.Teams.Plugins.AspNetCore.Extensions;
using Microsoft.Teams.Common.Storage;
using Microsoft.Teams.Apps;

using DexAgent;
using DexAgent.Interfaces;
using DexAgent.Controllers;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

var appBuilder = App.Builder()
    .AddLogger(level: Microsoft.Teams.Common.Logging.LogLevel.Debug)
    // The name of the auth connection to use.
    // It should be the same as the OAuth connection name defined in the Azure Bot configuration.
    .AddOAuth("github");

builder.AddTeams(appBuilder).AddTeamsDevTools();

builder.Services.Configure<ConfigOptions>(builder.Configuration);
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<ConfigOptions>>().Value);

builder.Services.AddSingleton<LocalStorage<object>>();

builder.Services.AddHttpClient<GitHubPlugin>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(600);
});
builder.Services.AddTransient<IRepositoryPlugin, GitHubPlugin>();
builder.Services.AddTransient<IRepositoryService, GitHubService>();

builder.Services.AddSingleton<KernelFactory>();
builder.Services.AddSingleton(sp =>
{
    var factory = sp.GetRequiredService<KernelFactory>();
    return factory.Create();
});

builder.Services.AddTransient<KernelOrchestrator>();
builder.Services.AddTransient<BotController>();

var app = builder.Build();

app.UseTeams();
app.Run();