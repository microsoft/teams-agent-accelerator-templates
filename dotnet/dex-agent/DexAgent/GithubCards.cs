using DexAgent.GitHubModels;
using Microsoft.Teams.Cards;
using Newtonsoft.Json.Linq;
using Microsoft.Teams.Common;

namespace DexAgent
{
    /// <summary>

    /// <summary>
    /// Creates the adaptive cards for the GitHub pull requests.
    /// </summary>
    public class GitHubCards
    {
        /// <summary>
        /// Creates the adaptive card for the "ListPRs" plugin
        /// </summary>
        /// <param name="title">The title of the card</param>
        /// <param name="pullRequests">The list of pull requests</param>
        /// <param name="allLabels">All the labels for filtering</param>
        /// <param name="allAssignees">All the assignees for filtering</param>
        /// <param name="allAuthors">All the authors for filtering</param>
        /// <returns> An AdaptiveCard instance representing the list of pull requests.</returns>
        public static AdaptiveCard CreateListPRsAdaptiveCard(string title, IList<GitHubPR> pullRequests, HashSet<string> allLabels, HashSet<string> allAssignees, HashSet<string> allAuthors)
        {
            // PR Items Container
            // This container will hold the list of pull requests
            var prListContainer = new Container().WithId("prContainer").WithItems(new List<CardElement>());

            if (pullRequests == null || pullRequests.Count == 0)
            {
                prListContainer.Items.Add(
                    new TextBlock("No pull requests found 🚫").WithWrap(true)
                );
            }
            else
            {
                foreach (var pr in pullRequests)
                {
                    prListContainer.Items.Add(CreatePRItemContainer(pr));
                }
            }

            // Filter Container
            var filterContainer = new Container(
                new TextBlock("🔍 Filters").WithWeight(TextWeight.Bolder),
                new ChoiceSetInput()
                    .WithId("labelFilter")
                    .WithStyle(StyleEnum.Compact)
                    .WithIsMultiSelect(true)
                    .WithLabel("Labels")
                    .WithChoices(allLabels.Select(label => new Choice().WithTitle(label).WithValue(label)).ToList()),
                new ChoiceSetInput()
                    .WithId("assigneeFilter")
                    .WithStyle(StyleEnum.Compact)
                    .WithIsMultiSelect(true)
                    .WithLabel("Assignees")
                    .WithChoices(allAssignees.Select(assignee => new Choice().WithTitle(assignee).WithValue(assignee)).ToList()),
                new ChoiceSetInput()
                .WithId("authorFilter")
                .WithStyle(StyleEnum.Compact)
                .WithIsMultiSelect(true)
                .WithLabel("Authors")
                .WithChoices(allAuthors.Select(author => new Choice().WithTitle(author).WithValue(author)).ToList()),
                new ActionSet(
                    new ExecuteAction()
                        .WithTitle("Apply Filters")
                        .WithData(new SubmitActionData
                        {
                            NonSchemaProperties = new Dictionary<string, object?>
                            {
                                { "pullRequests", pullRequests }
                            }
                        })
                )
            ).WithSpacing(Spacing.Medium);

            AdaptiveCard card = new AdaptiveCard(
                new TextBlock($"📄 {title}").WithWeight(TextWeight.Bolder).WithSize(TextSize.Large).WithColor(TextColor.Accent),
                prListContainer,
                filterContainer
            );

            return card;
        }

        /// <summary>
        /// Creates an adaptive card for filtering pull requests.
        /// </summary>
        /// <param name="title">The title of the card</param>
        /// <param name="pullRequests">The list of pull requests</param>
        /// <param name="selectedLabels">The selected labels for filtering</param>  
        /// /// <param name="selectedAssignees">The selected assignees for filtering</param>
        /// <param name="selectedAuthors">The selected authors for filtering</param>
        /// <returns>An AdaptiveCard instance representing the filtered pull requests.</returns>
        public static AdaptiveCard CreateFilterPRsAdaptiveCard(
            string title,
            IList<GitHubPR>? pullRequests,
            string[] selectedLabels,
            string[] selectedAssignees,
            string[] selectedAuthors)
        {

            var prListContainer = new Container().WithId("prContainer").WithItems(new List<CardElement>());

            if (pullRequests == null || pullRequests.Count == 0)
            {
                prListContainer.Items.Add(
                    new TextBlock("No pull requests found")
                        .WithWrap(true)
                );
            }
            else
            {
                foreach (var pr in pullRequests)
                {
                    prListContainer.Items.Add(CreatePRItemContainer(pr));
                }
            }

            AdaptiveCard card = new AdaptiveCard(
                new TextBlock($"{title}").WithWeight(TextWeight.Bolder).WithSize(TextSize.Large),
                prListContainer
            );

            var combinedFilters = selectedLabels
                .Concat(selectedAssignees)
                .Concat(selectedAuthors)
                .ToArray();

            if (combinedFilters.Length > 0)
            {
                var filterContainer = new Container()
                    .WithItems(
                        new TextBlock("Filters applied:")
                            .WithWeight(TextWeight.Bolder)
                            .WithSize(TextSize.Medium)
                    );

                foreach (var filter in combinedFilters)
                {
                    filterContainer.Items.Add(
                        new TextBlock(filter)
                            .WithColor(TextColor.Accent)
                            .WithWeight(TextWeight.Bolder)
                            .WithSize(TextSize.Small)
                            .WithWrap(true)
                            .WithSpacing(Spacing.Small)
                    );
                }

                card.Body.Add(filterContainer);

            }

            return card;
        }

        /// <summary>
        /// Creates a container for a single pull request item.
        /// </summary>
        /// /// <param name="pr">The pull request object</param>
        /// <returns>A Container instance representing the pull request item.</returns>
        public static Container CreatePRItemContainer(GitHubPR pr)
        {
            var prItemContainer = new Container(
                new ColumnSet().WithColumns(
                    new Column()
                        .WithTargetWidth(TargetWidth.Wide)
                        .WithItems(
                            new TextBlock($"#{pr.Number}: {pr.Title}")
                                .WithWeight(TextWeight.Bolder)
                                .WithWrap(true)
                                .WithSize(TextSize.Small)
                                .WithColor(TextColor.Accent)
                        )
                ),
                new TextBlock($"**Author**: {pr.User.Login ?? "Unknown"}")
                    .WithIsSubtle(true)
                    .WithSpacing(Spacing.None),
                new TextBlock($"**Created**: {pr.CreatedAt: MMMM dd, yyyy}")
                    .WithIsSubtle(true)
                    .WithSpacing(Spacing.None),
                new TextBlock($"**Status**: {(pr.State == "open" ? "🟢 Open" : "🔴 Closed")}")
                    .WithIsSubtle(true)
                    .WithSpacing(Spacing.None)
            )
            .WithSpacing(Spacing.Medium)
            .WithStyle(ContainerStyle.Accent);

            // Labels (if any)
            if (pr.Labels is { Count: > 0 })
            {
                var labelText = string.Join(", ", pr.Labels.Select(l => l.Name));
                prItemContainer.Items.Add(
                    new TextBlock($"**Labels**: {labelText}")
                        .WithIsSubtle(true)
                        .WithSpacing(Spacing.None)
                        .WithWrap(true)
                );
            }

            // Toggle visibility for PR description
            prItemContainer.Items.Add(
                new ActionSet(
                    new ToggleVisibilityAction()
                        .WithTitle("Show/Hide Description").WithTargetElements(
                            new Union<IList<string>, IList<TargetElement>>(
                                new List<TargetElement>
                                {
                                    new TargetElement { ElementId = $"description-{pr.Number}" }
                                }
                            )
                        )
                )
            );


            // Hidden description block
            prItemContainer.Items.Add(
                new TextBlock($"description: {pr.Body}")
                    .WithId($"description-{pr.Number}")
                    .WithWrap(true)
                    .WithIsSubtle(true)
                    .WithSpacing(Spacing.None)
                    .WithIsVisible(false)
            );

            // GitHub URL button
            if (!string.IsNullOrEmpty(pr.HtmlUrl))
            {
                prItemContainer.Items.Add(
                    new ActionSet(
                        new OpenUrlAction(pr.HtmlUrl)
                            .WithTitle("View on GitHub")
                        )
                );
            }

            return prItemContainer;
        }


        /// <summary>
        /// Creates an adaptive card for pull request assignment notifications.
        /// </summary>
        /// /// <param name="payload">The JSON payload containing pull request details.</param>
        /// <returns>An AdaptiveCard instance representing the pull request assignment notification.</returns>
        public static AdaptiveCard CreatePullRequestCard(JObject payload)
        {
            var pullRequest = payload["pull_request"] ?? throw new InvalidOperationException("Payload does not contain 'pull_request' object.");
            string assignee = pullRequest["assignee"]?["login"]?.ToString() ?? "Unknown User";
            string prTitle = pullRequest["title"]?.ToString() ?? "Untitled PR";
            string prUrl = pullRequest["html_url"]?.ToString() ?? "#";
            int prNumber = pullRequest["number"]?.Value<int>() ?? -1;

            AdaptiveCard card = new AdaptiveCard(
                new TextBlock($"👤 Assignee Request for PR #{prNumber}").WithWeight(TextWeight.Bolder).WithSize(TextSize.Large).WithColor(TextColor.Accent),
                new TextBlock($"{prTitle}").WithWeight(TextWeight.Bolder).WithSize(TextSize.Medium).WithWrap(true),
                new TextBlock($"{assignee} has been assigned this pull request.").WithSize(TextSize.Medium).WithWrap(true).WithSpacing(Spacing.Medium),
                new ActionSet(
                    new OpenUrlAction($"{prUrl}").WithTitle("View on GitHub")
                )
            );

            return card;
        }

        /// <summary>
        /// Creates an adaptive card for pull request status updates.
        /// </summary>
        /// <param name="payload">The JSON payload containing pull request details.</param>
        /// <returns>An AdaptiveCard instance representing the pull request status update.</returns>
        public static AdaptiveCard CreatePullRequestStatusCard(JObject payload)
        {
            var pullRequest = payload["pull_request"] ?? throw new InvalidOperationException("Payload does not contain 'pull_request' object.");
            string action = payload["action"]?.ToString() ?? "unknown";
            string prTitle = pullRequest["title"]?.ToString() ?? "Untitled PR";
            string prUrl = pullRequest["html_url"]?.ToString() ?? "#";
            int prNumber = pullRequest["number"]?.Value<int>() ?? -1;

            AdaptiveCard card = new AdaptiveCard(
                new TextBlock($"🔔 Status Update for PR #{prNumber}").WithWeight(TextWeight.Bolder).WithSize(TextSize.Large).WithColor(TextColor.Accent),
                new TextBlock($"{prTitle}").WithWeight(TextWeight.Bolder).WithSize(TextSize.Medium).WithWrap(true),
                new TextBlock($"PR is now {action}").WithSize(TextSize.Medium).WithWrap(true).WithSpacing(Spacing.Medium),
                new ActionSet(
                    new OpenUrlAction($"{prUrl}").WithTitle("View on GitHub")
                )
            );

            return card;
        }
    }
}
