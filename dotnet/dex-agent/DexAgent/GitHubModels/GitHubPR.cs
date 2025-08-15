using Newtonsoft.Json;

namespace DexAgent.GitHubModels
{
    /// <summary>
    /// Defines a GitHub pull request.
    /// </summary>
    [JsonConverter(typeof(PullRequestConverter))]
    public class GitHubPR
    {
        /// <summary>
        /// The title of the PR.
        /// </summary>
        public string? Title { get; set; }
        /// <summary>
        /// The number assigned to the PR.
        /// </summary>
        public int Number { get; set; }
        /// <summary>
        /// The state of the PR.
        /// </summary>
        public string? State { get; set; }
        /// <summary>
        /// The user who created the PR.
        /// </summary>
        public GitHubUser? User { get; set; }
        /// <summary>
        /// The date the PR was created.
        /// </summary>
        public DateTime CreatedAt { get; set; }
        /// <summary>
        /// The link to the PR.
        /// </summary>
        public string? HtmlUrl { get; set; }
        /// <summary>
        /// The labels for the PR.
        /// </summary>
        public IList<GitHubLabel>? Labels { get; set; }
        /// <summary>
        /// The assignees for the PR.
        /// </summary>
        public IList<GitHubUser>? Assignees { get; set; }
        /// <summary>
        /// The contents of the PR.
        /// </summary>
        public string? Body { get; set; }
    }

}
