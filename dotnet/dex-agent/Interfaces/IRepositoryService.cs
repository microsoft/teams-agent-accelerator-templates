using Microsoft.Bot.Builder;
using Microsoft.Teams.AI;

namespace DexAgent.Interfaces
{
    /// <summary>
    /// The interface for a repository service.
    /// Manages all repository-related operations,
    /// including webhooks and plugins.
    /// </summary>
    public abstract class IRepositoryService
    {
        /// <summary>
        /// Used to retrieve information on previous convos.
        /// </summary>
        public MemoryStorage Storage { get; set; }

        /// <summary>
        /// Used to send proactive notifications.
        /// </summary>
        public TeamsAdapter Adapter { get; set; }

        /// <summary>
        /// The repository plugin used for this service.
        /// </summary>
        public IRepositoryPlugin RepositoryPlugin { get; set; }

        /// <summary>
        /// Handles the webhook events from the repository.
        /// </summary>
        /// <param name="payload">The incoming payload</param>
        /// <param name="request">The incoming request</param>
        /// <param name="response">The outgoing response</param>
        /// <param name="cancellationToken">Cancellation token</param>
        /// <returns></returns>
        public abstract Task HandleWebhook(dynamic payload, HttpRequest request, HttpResponse response, CancellationToken cancellationToken);
    }
}
