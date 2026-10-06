using System.ComponentModel;
using Microsoft.SemanticKernel;

namespace DexAgent.Interfaces
{
    /// <summary>
    /// Defines a repository plugin.
    /// Plugins must adhere to Semantic Kernel.
    /// </summary>
    public abstract class IRepositoryPlugin
    {
        /// <summary>
        /// Provides access to keys for auth.
        /// </summary>
        public ConfigOptions Config { get; }

        /// <summary>
        /// The HTTP client used for making API requests.
        /// </summary>
        public HttpClient HttpClient { get; }

        protected IRepositoryPlugin(HttpClient httpClient, ConfigOptions config)
        {
            HttpClient = httpClient;
            Config = config;
        }

        /// <summary>
        /// Lists the pull requests for the repository.
        /// </summary>
        /// <param name="kernel">The associated kernel instance.</param>
        /// <returns>A serialized adaptive card string of the pull requests.</returns>
        [KernelFunction, Description("Lists the pull requests")]
        public abstract Task<string> ListPRs(Kernel kernel);
    }
}