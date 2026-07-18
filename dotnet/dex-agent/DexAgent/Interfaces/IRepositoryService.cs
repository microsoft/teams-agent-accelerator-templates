using Microsoft.Teams.Apps;
using Microsoft.Teams.Common.Storage;

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
        public LocalStorage<object> Storage { get; }

        /// <summary>
        /// The application instance.
        /// </summary>
        public App App { get; }

        /// <summary>
        /// The configuration options for the repository service.
        /// </summary>
        public ConfigOptions Config { get; }

        /// <summary>
        /// The repository plugin used for this service.
        /// </summary>
        public IRepositoryPlugin RepositoryPlugin { get; }

        protected IRepositoryService(ConfigOptions config, LocalStorage<object> storage, App app, IRepositoryPlugin repositoryPlugin)
        {
            Config = config;
            Storage = storage;
            App = app;
            RepositoryPlugin = repositoryPlugin;
        }

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