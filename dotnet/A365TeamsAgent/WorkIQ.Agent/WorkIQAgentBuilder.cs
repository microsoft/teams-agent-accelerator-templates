// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Extensions.AI;

namespace WorkIQ.Agent;

/// <summary>
/// Fluent builder for configuring <see cref="WorkIQAgent"/> services.
/// Used as the parameter to <see cref="WorkIQAgentServiceExtensions.AddWorkIQAgent"/>.
/// All settings have sensible defaults; call only the methods you need to override.
/// </summary>
public sealed class WorkIQAgentBuilder
{
    internal Action<WorkIQAgentOptions>? OptionsConfigurator { get; private set; }
    internal Func<IServiceProvider, IChatClient>? ChatClientFactory { get; private set; }
    internal Type? HistoryStoreType { get; private set; }
    internal bool OpenTelemetryEnabled { get; private set; }
    internal Action<WorkIQOpenTelemetryOptions>? OpenTelemetryConfigurator { get; private set; }

    /// <summary>
    /// Override default option values (system prompt, max history, MCP URLs) in code.
    /// Code overrides take precedence over <c>appsettings.json</c>.
    /// </summary>
    public WorkIQAgentBuilder ConfigureOptions(Action<WorkIQAgentOptions> configure)
    {
        ArgumentNullException.ThrowIfNull(configure);
        OptionsConfigurator = configure;
        return this;
    }

    /// <summary>
    /// Supply a custom <see cref="IChatClient"/> factory. The builder automatically
    /// wraps it with <c>.UseFunctionInvocation()</c> (required for MCP tool calls).
    /// When omitted, the default factory creates an Azure OpenAI client from configuration.
    /// </summary>
    public WorkIQAgentBuilder WithChatClient(Func<IServiceProvider, IChatClient> factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        ChatClientFactory = factory;
        return this;
    }

    /// <summary>
    /// Replace the default <see cref="InMemoryConversationHistoryStore"/> with a custom
    /// <see cref="IConversationHistoryStore"/> implementation (e.g. Redis-backed).
    /// The implementation is registered as a singleton.
    /// </summary>
    public WorkIQAgentBuilder WithConversationHistoryStore<T>() where T : class, IConversationHistoryStore
    {
        HistoryStoreType = typeof(T);
        return this;
    }

    /// <summary>
    /// Enable OpenTelemetry with OTLP, Azure Monitor, and Agent365 exporters.
    /// Pass an optional <paramref name="configure"/> action to customize activity sources,
    /// meter names, and the root service provider accessor for Agent365 telemetry.
    /// </summary>
    public WorkIQAgentBuilder WithOpenTelemetry(Action<WorkIQOpenTelemetryOptions>? configure = null)
    {
        OpenTelemetryEnabled = true;
        OpenTelemetryConfigurator = configure;
        return this;
    }
}

/// <summary>
/// Options for configuring OpenTelemetry when enabled via
/// <see cref="WorkIQAgentBuilder.WithOpenTelemetry"/>.
/// </summary>
public sealed class WorkIQOpenTelemetryOptions
{
    /// <summary>
    /// Extra activity source names to subscribe to beyond the built-in defaults.
    /// </summary>
    public string[]? AdditionalActivitySources { get; set; }

    /// <summary>
    /// Extra meter names to subscribe to beyond the built-in defaults.
    /// </summary>
    public string[]? AdditionalMeterNames { get; set; }

    /// <summary>
    /// Accessor for the root <see cref="IServiceProvider"/>, needed for the Agent365
    /// contextual token resolver. Set this after building the app, e.g.
    /// <c>() =&gt; rootServiceProvider</c>.
    /// </summary>
    public Func<IServiceProvider>? RootProviderAccessor { get; set; }
}
