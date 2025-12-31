using Microsoft.Teams.Api.Activities;
using Microsoft.Teams.Apps;
using Microsoft.Teams.Apps.Events;
using Microsoft.Teams.Apps.Activities;
using Microsoft.Teams.Apps.Annotations;
using Microsoft.Teams.Apps.Plugins;
using Microsoft.Teams.Apps.Activities.Invokes;
using Microsoft.SemanticKernel;
using DexAgent.GitHubModels;
using Newtonsoft.Json;
using Microsoft.SemanticKernel.ChatCompletion;

namespace DexAgent.Controllers;

[TeamsController]
public class BotController(ConfigOptions config, Kernel kernel, KernelOrchestrator orchestrator)
{
    private readonly ConfigOptions Config = config;
    private readonly KernelOrchestrator Orchestrator = orchestrator;
    private readonly Kernel kernel = kernel;

    [Message("/signout")]
    public async Task OnSignOutMessage(IContext<MessageActivity> context)
    {
        await context.SignOut();
        Config.GitHub.AuthToken = null;
        await context.Send("you are signed out!");
    }

    [AdaptiveCard.Action]
    public async Task OnAdaptiveCardAction(IContext<Microsoft.Teams.Api.Activities.Invokes.AdaptiveCards.ActionActivity> context)
    {
        string jsonString = System.Text.Json.JsonSerializer.Serialize(context.Activity.Value.Action.Data);
        GitHubFilterActivity? filterData = JsonConvert.DeserializeObject<GitHubFilterActivity>(jsonString);

        var labels = filterData?.LabelFilter;
        var assignees = filterData?.AssigneeFilter;
        var authors = filterData?.AuthorFilter;
        var pullRequests = filterData?.PullRequests;

        if (string.IsNullOrEmpty(labels) && string.IsNullOrEmpty(assignees) && string.IsNullOrEmpty(authors))
        {
            await context.Send("Please select at least one filter.");
            return;
        }

        if (pullRequests == null || pullRequests.Count == 0)
        {
            await context.Send("No pull requests available to filter.");
            return;
        }

        KernelArguments args = new()
        {
            { "labels", labels },
            { "assignees", assignees },
            { "authors", authors },
            { "pullRequests", pullRequests }
        };
        kernel.Data["context"] = context.ToActivityType<Activity>();

        var result = await kernel.InvokeAsync("GitHubPlugin", "FilterPRs", args);
        string? activity = result.GetValue<string>();
        await Orchestrator.SaveActivityToChatHistory(context.ToActivityType<Activity>(), activity);
    }

    [Message]
    public async Task OnMessage(IContext<MessageActivity> context)
    {
        if (Config.GitHub.AuthToken == null)
        {
            var tokenResponse = await context.SignIn(new OAuthOptions()
            {
                OAuthCardText = "Sign in to your github account",
                SignInButtonText = "Sign In"
            });
            if (tokenResponse != null)
            {
                Config.GitHub.AuthToken = tokenResponse;
                await Orchestrator.CreateChatHistory(context.ToActivityType<Activity>(), context.Activity.Text, AuthorRole.User);
                await Orchestrator.GetChatMessageContentAsync(context);
            }

            return;
        }
        await Orchestrator.CreateChatHistory(context.ToActivityType<Activity>(), context.Activity.Text, AuthorRole.User);
        await Orchestrator.GetChatMessageContentAsync(context);
    }

    [Event("signin")]
    public async Task OnSignIn(IPlugin plugin, SignInEvent @event)
    {
        var token = @event.Token;
        var context = @event.Context;

        Config.GitHub.AuthToken = token.Token;

        MessageActivity activity = new MessageActivity("You have been signed in successfully.");
        await context.Send(activity);
        await Orchestrator.CreateChatHistory(context.ToActivityType<Activity>(), activity.Text, AuthorRole.Assistant);
    }

}