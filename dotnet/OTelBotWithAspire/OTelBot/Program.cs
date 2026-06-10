using Microsoft.Teams.Apps;
using Microsoft.Teams.Apps.Handlers;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults(); // configures open telemetry, health checks, and service discovery
builder.Services.AddTeamsBotApplication();
WebApplication app = builder.Build();

TeamsBotApplication bot = app.UseTeamsBotApplication();

bot.OnMessage(async (ctx, ct) =>
{
    string? message = ctx.Activity.TextWithoutMentions;
    await ctx.SendActivityAsync($"Echo: {message}", ct);
});

app.MapDefaultEndpoints();
app.Run();

