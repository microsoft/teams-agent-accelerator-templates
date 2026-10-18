namespace DexAgent
{
    /// <summary>
    /// Manages the configuration keys.
    /// </summary>
    public class ConfigOptions
    {
        public string? ClientId { get; set; }
        public AzureConfigOptions? Azure { get; set; }
        public GitHubConfigOptions? GitHub { get; set; }
    }

    /// <summary>
    /// Configuration options for GitHub integration.
    /// </summary>
    public class GitHubConfigOptions
    {
        public string? Owner { get; set; }
        public string? Repository { get; set; }
        public string? AuthToken { get; set; }  
    }

    /// <summary>
    /// Options for Azure OpenAI
    /// </summary>
    public class AzureConfigOptions
    {
        public string? OpenAIApiKey { get; set; }
        public string? OpenAIEndpoint { get; set; }
        public string? OpenAIDeploymentName { get; set; }
        public string? OpenAIModelId { get; set; }
    }
}