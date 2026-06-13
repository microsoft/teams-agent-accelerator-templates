using Newtonsoft.Json;

namespace DexAgent.GitHubModels
{
    /// <summary>
    /// Defines a GitHub PR Label.
    /// </summary>
    public class GitHubLabel
    {
        /// <summary>
        /// The name of the label.
        /// </summary>
        [JsonProperty("Name")]
        public string? Name { get; set; }
    }
}