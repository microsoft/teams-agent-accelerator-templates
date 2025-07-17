using DexAgent;
using DexAgent.Interfaces;
using Microsoft.SemanticKernel;

public class KernelFactory
{
    private readonly ConfigOptions _config;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IRepositoryService _repositoryService;

    public KernelFactory(ConfigOptions configOptions, IHttpClientFactory httpClientFactory, IRepositoryService repositoryService)
    {
        _config = configOptions;
        _httpClientFactory = httpClientFactory;
        _repositoryService = repositoryService;
    }

    public Kernel Create()
    {
        var httpClient = _httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(600);

        var kernelBuilder = Kernel.CreateBuilder();
        kernelBuilder.Services.AddLogging(logging => logging.AddConsole());

        kernelBuilder.AddAzureOpenAIChatCompletion(
            deploymentName: _config.Azure.OpenAIDeploymentName ?? throw new InvalidOperationException("OpenAI Deployment Name is not configured."),
            modelId: _config.Azure.OpenAIModelId ?? throw new InvalidOperationException("OpenAI Model Id is not configured."),
            apiKey: _config.Azure.OpenAIApiKey ?? throw new InvalidOperationException("OpenAI API Key is not configured."),
            endpoint: _config.Azure.OpenAIEndpoint ?? throw new InvalidOperationException("OpenAI Endpoint is not configured."),
            httpClient: httpClient);

        GitHubPlugin plugin = (GitHubPlugin)_repositoryService.RepositoryPlugin;
        kernelBuilder.Plugins.AddFromObject(plugin, "GitHubPlugin");

        return kernelBuilder.Build();
    }
}
