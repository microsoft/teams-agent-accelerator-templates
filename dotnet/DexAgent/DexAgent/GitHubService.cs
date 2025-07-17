using DexAgent.Interfaces;
using Microsoft.Teams.Apps;
using Microsoft.Teams.Common.Storage;
using Microsoft.Teams.Cards;
using Microsoft.Teams.Api;
using Microsoft.Teams.Api.Activities;

namespace DexAgent
{
    /// <summary>
    /// This service extends the base repository service and provides methods to list pull requests,
    /// filter pull requests, and handle GitHub webhooks for pull request events.
    /// </summary>
    public class GitHubService : IRepositoryService
    {

        public GitHubService(ConfigOptions config, LocalStorage<object> storage, Microsoft.Teams.Apps.App app, IRepositoryPlugin repositoryPlugin)
            : base(config, storage, app, repositoryPlugin)
        {
        }

        public override async Task HandleWebhook(dynamic payload, HttpRequest request, HttpResponse response, CancellationToken cancellationToken)
        {
            var eventType = request.Headers["x-github-event"].ToString();

            var prLabels = new List<string>() { "closed", "opened", "reopened", "ready_for_review" };

            // Handle pull request assignment events
            if (eventType == "pull_request" && (payload.action == "assigned"))
            {
                await HandlePRAssignments(payload, cancellationToken);
            } // Handle pull request state changes
            else if (eventType == "pull_request" && prLabels.Contains(payload.action.ToString()))
            {
                await HandlePRStatusChanges(payload, cancellationToken);
            }

            response.StatusCode = 200;
            await response.WriteAsync("Event received", cancellationToken);
        }

        /// <summary>
        /// Handles pull request assignment events and sends an adaptive card to the user.
        /// </summary>
        /// <param name="payload">The payload containing the pull request data.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns></returns>
        private async Task HandlePRAssignments(dynamic payload, CancellationToken cancellationToken)
        {
            foreach (var id in Storage!.Keys)
            {
                AdaptiveCard card = GitHubCards.CreatePullRequestCard(payload);

                List<ConversationInfo>? convos = await Storage.GetAsync<List<ConversationInfo>>("conversations");
                List<ConversationInfo> group_convos = convos.FindAll(x => x.IsGroup);
                
                foreach (var convo in group_convos)
                {
                    if (string.IsNullOrEmpty(convo.ChannelId))
                    {
                        await App.Send(convo.Id ?? throw new InvalidOperationException("Conversation ID not found"), card, convo.ServiceUrl);
                    }
                    else
                    {
                        await App.SendToChannel(convo.ChannelId, card, convo.ServiceUrl);
                    }
                }
            }
        }

        /// <summary>
        /// Handles pull request status changes and sends an adaptive card to the user.
        /// </summary>
        /// <param name="payload">The payload containing the pull request data.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns></returns>
        private async Task HandlePRStatusChanges(dynamic payload, CancellationToken cancellationToken)
        {
            AdaptiveCard card = GitHubCards.CreatePullRequestStatusCard(payload);

            List<ConversationInfo>? convos = await Storage.GetAsync<List<ConversationInfo>>("conversations");
            List<ConversationInfo> group_convos = convos.FindAll(x => x.IsGroup);

            foreach (var convo in group_convos)
            {
                if (string.IsNullOrEmpty(convo.ChannelId))
                {
                    await App.Send(convo.Id ?? throw new InvalidOperationException("Conversation ID not found"), card, convo.ServiceUrl);
                }
                else
                {
                    await App.SendToChannel(convo.ChannelId, card, convo.ServiceUrl);
                }
            }
        }

    }
}
