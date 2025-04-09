using DexAgent.GitHubModels;
using Microsoft.Bot.Schema;
using Microsoft.SemanticKernel;
using Microsoft.Teams.AI;
using Newtonsoft.Json.Linq;

namespace DexAgent
{
    /// <summary>
    /// Registers the bot's activities and actions.
    /// </summary>
    public class DexBot
    {
        public DexBot(Application<AppState> app, ConfigOptions config, Kernel kernel, KernelOrchestrator orchestrator)
        {
            app.OnMessage("/signin", async (context, state, cancellationToken) =>
            {
                await app.Authentication.SignUserInAsync(context, state, cancellationToken: cancellationToken);
                config.AUTH_TOKEN = state.Temp.AuthTokens[config.OAUTH_CONNECTION_NAME];
                await context.SendActivityAsync("You have signed in.");
            });

            // Listen for user to say "/sigout" and then delete cached token
            app.OnMessage("/signout", async (context, state, cancellationToken) =>
            {
                await app.Authentication.SignOutUserAsync(context, state, cancellationToken: cancellationToken);
                await context.SendActivityAsync("You have signed out.");
            });

            app.AdaptiveCards.OnActionSubmit("githubFilters", async (context, state, data, cancellationToken) =>
            {
                GitHubFilterActivity filterData = (GitHubFilterActivity)((data as JObject)?.ToObject<GitHubFilterActivity>());

                var labels = filterData.LabelFilter;
                var assignees = filterData.AssigneeFilter;
                var authors = filterData.AuthorFilter;
                var pullRequests = filterData.PullRequests;

                if (string.IsNullOrEmpty(labels) && string.IsNullOrEmpty(assignees) && string.IsNullOrEmpty(authors))
                {
                    await context.SendActivityAsync("Please select at least one filter.");
                    return;
                }

                if (pullRequests.Count == 0)
                {
                    await context.SendActivityAsync("No pull requests to filter.");
                    return;
                }

                KernelArguments args = new KernelArguments();
                args.Add("labels", labels);
                args.Add("assignees", assignees);
                args.Add("authors", authors);
                args.Add("context", context);
                args.Add("pullRequests", pullRequests);

                var result = await kernel.InvokeAsync("GitHubPlugin", "FilterPRs", args, cancellationToken);
                string activity = result.GetValue<string>();
                await orchestrator.SaveActivityToChatHistory(context, activity);
            });

            app.OnActivity(ActivityTypes.Message, async (turnContext, turnState, cancellationToken) =>
            {
                var token = turnState.Temp.AuthTokens[config.OAUTH_CONNECTION_NAME];
                if (string.IsNullOrEmpty(token))
                {
                    await turnContext.SendActivityAsync("Please sign in first.");
                }

                // Saved to authenticate with SK's plugins
                config.AUTH_TOKEN = token;

                await orchestrator.CreateChatHistory(turnContext);

                // Check for pull requests
                if (turnContext.Activity.Text.IndexOf("pull requests", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    turnContext.Activity.Text.IndexOf("PR", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    KernelArguments args = new KernelArguments();
                    args.Add("context", turnContext);
                    var result = await kernel.InvokeAsync("GitHubPlugin", "ListPRs", args, cancellationToken);
                    string activity = result.GetValue<string>();
                    await orchestrator.SaveActivityToChatHistory(turnContext, activity);
                }
                else
                {
                    await orchestrator.GetChatMessageContentAsync(turnContext);
                }
            });

            app.Authentication.Get(config.OAUTH_CONNECTION_NAME).OnUserSignInSuccess(async (context, state) =>
            {
                // Saved to authenticate with SK's plugins
                config.AUTH_TOKEN = state.Temp.AuthTokens[config.OAUTH_CONNECTION_NAME];
                await context.SendActivityAsync("Successfully logged in!");
            });

            app.Authentication.Get(config.OAUTH_CONNECTION_NAME).OnUserSignInFailure(async (context, state, ex) =>
            {
                await context.SendActivityAsync("Sorry, we failed to log you in. Please try again.");
                await context.SendActivityAsync($"Error message: {ex.Message}");
            });
        }
    }
}
