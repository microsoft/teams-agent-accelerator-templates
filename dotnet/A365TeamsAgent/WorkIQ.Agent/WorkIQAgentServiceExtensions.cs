// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Azure.AI.OpenAI;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.TokenCacheProviders;
using Microsoft.Identity.Web.TokenCacheProviders.Distributed;
using System.ClientModel;

namespace WorkIQ.Agent;

/// <summary>
/// Extension methods for registering the <see cref="WorkIQAgent"/> and its dependencies.
/// </summary>
public static class WorkIQAgentServiceExtensions
{
    /// <summary>
    /// Registers <see cref="WorkIQAgent"/>, <see cref="IConversationHistoryStore"/>,
    /// <see cref="McpClientPool"/>, <see cref="IChatClient"/>, and optionally OpenTelemetry.
    /// Pass an optional <paramref name="configure"/> action to override defaults.
    /// </summary>
    public static TBuilder AddWorkIQAgent<TBuilder>(
        this TBuilder hostBuilder,
        Action<WorkIQAgentBuilder>? configure = null) where TBuilder : IHostApplicationBuilder
    {
        IServiceCollection services = hostBuilder.Services;
        IConfiguration configuration = hostBuilder.Configuration;

        // Bind options from configuration.
        services.Configure<WorkIQAgentOptions>(configuration.GetSection(WorkIQAgentOptions.SectionName));

        // Apply builder overrides.
        WorkIQAgentBuilder builder = new();
        configure?.Invoke(builder);

        // Code-based option overrides take precedence over config.
        if (builder.OptionsConfigurator is { } configurator)
        {
            services.PostConfigure(configurator);   
        }

        // Register the Agent Identities MSAL add-in so that WithAgentUserIdentity()
        // triggers the FIC (Federated Identity Credential) grant.
        services.AddAgentIdentities();

        // Register IChatClient — custom factory or default AzureOpenAI.
        if (builder.ChatClientFactory is { } factory)
        {
            services.AddChatClient(factory)
                .UseFunctionInvocation();
        }
        else
        {
            services.AddChatClient(sp =>
            {
                IConfiguration config = sp.GetRequiredService<IConfiguration>();
                string endpoint = config["AzureOpenAI:Endpoint"] ?? throw new InvalidOperationException("AzureOpenAI:Endpoint is required.");
                string apiKey = config["AzureOpenAI:ApiKey"] ?? throw new InvalidOperationException("AzureOpenAI:ApiKey is required.");
                string modelId = config["AzureOpenAI:ModelId"] ?? throw new InvalidOperationException("AzureOpenAI:ModelId is required.");

                // Store the deployment name in options for telemetry.
                IOptions<WorkIQAgentOptions> agentOptions = sp.GetRequiredService<IOptions<WorkIQAgentOptions>>();
                agentOptions.Value.ModelDeploymentName = modelId;

                return new AzureOpenAIClient(new Uri(endpoint), new ApiKeyCredential(apiKey))
                    .GetChatClient(modelId)
                    .AsIChatClient();
            })
            .UseFunctionInvocation()
            .UseOpenTelemetry(sourceName: "Experimental.Microsoft.Extensions.AI");
        }

        services.AddScoped<McpClientFactory>();

        // MCP client pool caches long-lived clients per agentic user. A DelegatingHandler
        // injects a fresh bearer token on every outbound request so transports never go stale.
        services.AddSingleton<McpClientPool>();

        // Conversation history — custom or default InMemory.
        if (builder.HistoryStoreType is { } storeType)
        {
            services.AddSingleton(typeof(IConversationHistoryStore), storeType);
        }
        else
        {
            services.AddSingleton<IConversationHistoryStore, InMemoryConversationHistoryStore>();
        }

        // Agent is a per-turn execution unit; resolved from a fresh scope inside the bot handler.
        // Registered via factory because the constructor is internal (implementation detail).
        services.AddScoped(sp => new WorkIQAgent(
            sp.GetRequiredService<IChatClient>(),
            sp.GetRequiredService<McpClientFactory>(),
            sp.GetRequiredService<McpClientPool>(),
            sp.GetRequiredService<IConversationHistoryStore>(),
            sp.GetRequiredService<IOptions<WorkIQAgentOptions>>()));

        // Supply a distributed token cache so MSAL does not fall back to in-memory-only caching.
        // For production, replace AddDistributedMemoryCache with Redis/SQL Server.
        services.AddDistributedMemoryCache();
        services.AddSingleton<IMsalTokenCacheProvider, MsalDistributedTokenCacheAdapter>();

        // OpenTelemetry — configured when WithOpenTelemetry() was called on the builder.
        if (builder.OpenTelemetryEnabled)
        {
            WorkIQOpenTelemetryOptions otelOptions = new();
            builder.OpenTelemetryConfigurator?.Invoke(otelOptions);

            hostBuilder.ConfigureWorkIQOpenTelemetry(
                additionalActivitySources: otelOptions.AdditionalActivitySources,
                additionalMeterNames: otelOptions.AdditionalMeterNames,
                rootProviderAccessor: otelOptions.RootProviderAccessor);
        }

        return hostBuilder;
    }
}
