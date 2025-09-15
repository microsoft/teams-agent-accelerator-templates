using Newtonsoft.Json;

namespace DexAgent.GitHubModels
{
    /// <summary>
    /// Defines a GitHub User.
    /// </summary>
    public class GitHubUser
    {
        /// <summary>
        /// The user's name.
        /// </summary>
        [JsonProperty("Login")]
        public string? Login { get; set; }
        /// <summary>
        /// The user's ID
        /// </summary>.
        [JsonProperty("Id")]
        public int Id { get; set; }
    }
}