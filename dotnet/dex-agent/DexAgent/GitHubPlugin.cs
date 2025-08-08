using System.ComponentModel;
using System.Net.Http.Headers;
using DexAgent.GitHubModels;
using DexAgent.Interfaces;
using Microsoft.SemanticKernel;
using Microsoft.Teams.Api.Activities;
using Microsoft.Teams.Apps;
using Microsoft.Teams.Cards;
using Newtonsoft.Json;

namespace DexAgent
{
    /// <summary>
    /// This service extends the base repository service and provides methods to list pull requests,
    /// filter pull requests, and handle GitHub webhooks for pull request events.
    /// </summary>
    public class GitHubPlugin : IRepositoryPlugin
    {

        public GitHubPlugin(HttpClient httpClient, ConfigOptions config)
            : base(httpClient, config)
        {
        }

        /// <summary>
        /// Lists the pull requests for GitHub.
        /// </summary>
        /// <param name="kernel">The associated kernel instance.</param>
        /// <returns>A serialized adaptive card string of the pull requests.</returns>
        [KernelFunction, Description("Lists the pull requests")]
        public override async Task<string> ListPRs(Kernel kernel)
        {
            kernel.Data.TryGetValue("context", out object? contextObj);
            IContext<Activity>? context = contextObj as IContext<Activity>;

            try
            {

                string? owner = Config.GitHub?.Owner;
                string? repo = Config.GitHub?.Repository;
                string? token = Config.GitHub?.AuthToken;

                if (string.IsNullOrEmpty(owner) || string.IsNullOrEmpty(repo) || string.IsNullOrEmpty(token))
                {
                    MessageActivity error_activity = new MessageActivity
                    {
                        Text = "GitHub owner, repository, or token is not configured."
                    };
                    await context.Send(error_activity);
                    return JsonConvert.SerializeObject(error_activity);
                }

                HttpClient.DefaultRequestHeaders.Accept.Clear();
                HttpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github.v3+json"));
                HttpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("token", token);
                HttpClient.DefaultRequestHeaders.UserAgent.ParseAdd("GitHubPRFetcher");

                string apiUrl = $"https://api.github.com/repos/{owner}/{repo}/pulls?state=all";
                HttpResponseMessage response = await HttpClient.GetAsync(apiUrl);

                if (!response.IsSuccessStatusCode)
                {
                    string errorBody = await response.Content.ReadAsStringAsync();
                    Console.Error.WriteLine($"GitHub API Error Details: Status: {response.StatusCode}, " +
                                               $"Reason: {response.ReasonPhrase}, Body: {errorBody}");

                    throw new Exception($"GitHub API returned {response.StatusCode}: {errorBody}");
                }

                string jsonContent = await response.Content.ReadAsStringAsync();
                var pullRequests = JsonConvert.DeserializeObject<List<GitHubPR>>(jsonContent) ?? new List<GitHubPR>();

                // Extract metadata
                var authors = new HashSet<string>();
                var labels = new HashSet<string>();
                var assignees = new HashSet<string>();

                foreach (var pr in pullRequests)
                {
                    if (!string.IsNullOrEmpty(pr.User.Login))
                        authors.Add(pr.User.Login);

                    if (pr.Labels != null)
                    {
                        foreach (var label in pr.Labels)
                        {
                            if (!string.IsNullOrEmpty(label.Name))
                                labels.Add(label.Name);
                        }
                    }

                    if (pr.Assignees != null)
                    {
                        foreach (var assignee in pr.Assignees)
                        {
                            if (!string.IsNullOrEmpty(assignee.Login))
                                assignees.Add(assignee.Login);
                        }
                    }
                }

                // Create the adaptive card
                AdaptiveCard card = GitHubCards.CreateListPRsAdaptiveCard("Pull Requests", pullRequests, labels, assignees, authors);

                MessageActivity activity = new MessageActivity().AddAttachment(card);

                await context.Send(activity);
                return System.Text.Json.JsonSerializer.Serialize(activity);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error fetching pull requests: {ex.Message}");
                throw new Exception("Error accessing GitHub API", ex);
            }
        }

        /// <summary>
        /// Filters the pull requests based on labels, assignees, and authors.
        /// </summary>
        /// <param name="labels">The labels used to filter</param>
        /// <param name="assignees">The assignees used to filter</param>
        /// <param name="authors">The authors used to filter</param>
        /// <param name="context">The turn context</param>
        /// <param name="pullRequests">The list of pull requests</param>
        /// <returns></returns>
        [KernelFunction, Description("Filters the pull requests")]
        public async Task<string> FilterPRs(
            Kernel kernel,
           [Description("The label filters")] string labels,
           [Description("The assignee filters")] string assignees,
           [Description("The author filters")] string authors,
           [Description("The pull requests")] IList<GitHubPR> pullRequests)
        {
            kernel.Data.TryGetValue("context", out object? contextObj);
            IContext<Activity>? context = contextObj as IContext<Activity>;

            var labelsArr = string.IsNullOrEmpty(labels) ? Array.Empty<string>() : labels.Split(',');
            var assigneesArr = string.IsNullOrEmpty(assignees) ? Array.Empty<string>() : assignees.Split(',');
            var authorsArr = string.IsNullOrEmpty(authors) ? Array.Empty<string>() : authors.Split(',');

            var filteredPullRequests = pullRequests?.Where(pr =>
                (labelsArr.Length == 0 || pr.Labels?.Any(label => labelsArr.Contains(label.Name)) == true) &&
                (assigneesArr.Length == 0 || pr.Assignees?.Any(assignee => assigneesArr.Contains(assignee.Login)) == true) &&
                (authorsArr.Length == 0 || authorsArr.Contains(pr.User?.Login))
            ).ToList();

            AdaptiveCard card = GitHubCards.CreateFilterPRsAdaptiveCard("Filtered PRs", filteredPullRequests, labelsArr, assigneesArr, authorsArr);
            MessageActivity activity = new MessageActivity().AddAttachment(card);

            await context.Send(activity);
            return System.Text.Json.JsonSerializer.Serialize(activity);
            }

    }
}