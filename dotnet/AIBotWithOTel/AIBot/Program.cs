using Azure.AI.OpenAI;
using Microsoft.Extensions.AI;
using Microsoft.Teams.Apps;
using Microsoft.Teams.Apps.Handlers;
using Microsoft.Teams.Apps.Schema;
using ModelContextProtocol.Client;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults(); // configures open telemetry, health checks, and service discovery
builder.Services.AddTeamsBotApplication();

string endpoint = builder.Configuration["AZURE_OPENAI_ENDPOINT"] ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT configuration is required.");
string deployment = builder.Configuration["AZURE_OPENAI_DEPLOYMENT"] ?? throw new InvalidOperationException("AZURE_OPENAI_DEPLOYMENT configuration is required.");
string openaiKey = builder.Configuration["AZURE_OPENAI_KEY"] ?? throw new InvalidOperationException("AZURE_OPENAI_KEY configuration is required.");

IChatClient innerClient = new AzureOpenAIClient(new Uri(endpoint), new Azure.AzureKeyCredential(openaiKey))
    .GetChatClient(deployment)
    .AsIChatClient();

HttpClientTransport mcpTransport = new(new HttpClientTransportOptions
{
    Endpoint = new Uri("https://learn.microsoft.com/api/mcp")
});
McpClient mcpClient = await McpClient.CreateAsync(mcpTransport);
IList<McpClientTool> tools = await mcpClient.ListToolsAsync();
ChatOptions options = new() { Tools = [.. tools] };

IChatClient chatClient = innerClient
    .AsBuilder()
    .UseFunctionInvocation()
    .UseOpenTelemetry(sourceName: "Experimental.Microsoft.Extensions.AI")
    .Build();

WebApplication app = builder.Build();

TeamsBotApplication bot = app.UseTeamsBotApplication();

bot.OnMessage(async (ctx, ct) =>
{
    string? message = ctx.Activity.TextWithoutMentions;
    
    ChatResponse response = await chatClient.GetResponseAsync(message!, options, ct);

    await ctx.SendActivityAsync(TeamsActivity.CreateBuilder()
        .WithText(response.Text, TextFormats.Markdown)
        .Build(), ct);
});

app.MapDefaultEndpoints();
app.Run();
