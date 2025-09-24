using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace DexAgent.GitHubModels

{
    public class PullRequestConverter : JsonConverter<GitHubPR>
    {
        public override GitHubPR ReadJson(JsonReader reader, Type objectType, GitHubPR? existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            var jo = JObject.Load(reader);

            var pr = new GitHubPR
            {
                Title = jo["title"]?.ToString() ?? jo["Title"]?.ToString(),
                Number = jo["number"]?.ToObject<int?>() ?? jo["Number"]?.ToObject<int>() ?? 0,
                State = jo["state"]?.ToString() ?? jo["State"]?.ToString(),
                HtmlUrl = jo["html_url"]?.ToString() ?? jo["HtmlUrl"]?.ToString(),
                CreatedAt = jo["created_at"]?.ToObject<DateTime?>() ?? jo["CreatedAt"]?.ToObject<DateTime>() ?? DateTime.MinValue,
                Body = jo["body"]?.ToString() ?? jo["Body"]?.ToString()
            };

            var labelsToken = jo["labels"] ?? jo["Labels"];
            if (labelsToken != null)
                pr.Labels = labelsToken.ToObject<List<GitHubLabel>>();

            var assigneesToken = jo["assignees"] ?? jo["Assignees"];
            if (assigneesToken != null)
                pr.Assignees = assigneesToken.ToObject<List<GitHubUser>>();

            var userToken = jo["user"] ?? jo["User"];
            if (userToken != null)
                pr.User = userToken.ToObject<GitHubUser>();

            return pr;
        }

        public override void WriteJson(JsonWriter writer, GitHubPR? value, JsonSerializer serializer)
        {
            JObject jo = new JObject
            {
                { "title", value.Title },
                { "number", value.Number },
                { "state", value.State },
                { "html_url", value.HtmlUrl },
                { "created_at", value.CreatedAt },
                { "body", value.Body },
                { "labels", JArray.FromObject(value.Labels ?? new List<GitHubLabel>()) },
                { "assignees", JArray.FromObject(value.Assignees ?? new List<GitHubUser>()) },
                { "user", JToken.FromObject(value.User ?? new GitHubUser()) }
            };
            jo.WriteTo(writer);
        }
    }
}

