# Building a Teams Bot Agent with Agent 365

[Agent 365](https://learn.microsoft.com/en-us/microsoft-agent-365/) is Microsoft's control plane for managing agents at enterprise scale - providing [identity](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-blueprint), observability, governance, security, and lifecycle management for every agent in your organization.

This tutorial shows how to use the [Teams SDK](https://learn.microsoft.com/en-us/microsoft-agent-365/developer/) to build a bot that participates in the Agent 365 ecosystem - without requiring the Agent 365 SDK. Using the Teams SDK directly, your agent gets [Entra-backed Agent Identity](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-blueprint), governed access to Microsoft 365 data via Agent 365's [MCP](https://learn.microsoft.com/en-us/microsoft-agent-365/developer/) servers, and [OpenTelemetry](https://opentelemetry.io/)-based observability.

The project is split into two parts:

- **`WorkIQ.Agent`** - A reusable class library that encapsulates MCP client pooling, token management, conversation history, and OpenTelemetry configuration. It exposes a single `AddWorkIQAgent` extension method with a fluent builder for customization.
- **`A365TeamsAgent`** - A minimal sample app that references the library and wires up the Teams bot handler.

We build the agent in two progressive steps:

1. **Step 1** - Connect to Agent 365 Work IQ MCP tools for Teams, Mail, Calendar, and Profile operations
2. **Step 2** - Add OpenTelemetry for distributed tracing, metrics, and logging

## Prerequisites

- .NET 10 SDK
- An Azure OpenAI deployment (endpoint, API key, model ID)
- An Azure AD app registration configured for the Teams bot (see [Get started with Agent 365 development](https://learn.microsoft.com/en-us/microsoft-agent-365/developer/get-started))

### Solution Structure

```
A365TeamsAgent.slnx
├── WorkIQ.Agent/              # Class library (reusable infrastructure)
│   ├── WorkIQAgent.cs
│   ├── WorkIQAgentOptions.cs
│   ├── WorkIQAgentBuilder.cs
│   ├── WorkIQAgentServiceExtensions.cs
│   ├── McpClientFactory.cs
│   ├── McpClientPool.cs
│   ├── IConversationHistoryStore.cs
│   └── OpenTelemetryExtensions.cs
│
└── A365TeamsAgent/            # Web app (the sample)
    ├── Program.cs
    ├── WorkIQTeamsBotApp.cs
    └── appsettings.json
```

The library (`WorkIQ.Agent`) contains these NuGet packages:

- `Microsoft.Teams.Apps`
- `Microsoft.Extensions.AI` / `Microsoft.Extensions.AI.OpenAI`
- `Azure.AI.OpenAI`
- `ModelContextProtocol`
- `Microsoft.OpenTelemetry` and OpenTelemetry instrumentation packages

The sample (`A365TeamsAgent`) only needs:

- `Microsoft.Teams.Apps`
- A project reference to `WorkIQ.Agent`

### App Settings

Configure `appsettings.json` with your Azure AD and Azure OpenAI credentials:

```json
{
  "$schema": "https://raw.githubusercontent.com/AzureAD/microsoft-identity-web/refs/heads/master/JsonSchemas/microsoft-identity-web.json",
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "your-tenant-id",
    "ClientId": "your-client-id",
    "ClientCredentials": [
      {
        "ClientSecret": "your-client-secret",
        "SourceType": "ClientSecret"
      }
    ]
  },
  "AzureOpenAI": {
    "Endpoint": "https://your-resource.openai.azure.com/",
    "ApiKey": "your-api-key",
    "ModelId": "gpt-4o"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

---

## Step 1: MCP Tools (WorkIQ Integration)

In this step we connect the agent to Agent 365's MCP servers, giving the LLM the ability to call tools for Teams messaging, email, calendar, and user profile operations. The `WorkIQ.Agent` library handles all the complexity: MCP client pooling, token management, conversation history, and the `IChatClient` pipeline.

### 1.1 Agent Options

The library's `WorkIQAgentOptions` class defines configurable defaults. The MCP server URLs, system prompt, and history limits can all be overridden via `appsettings.json` (section `"WorkIQAgent"`) or the fluent builder:

```csharp
public sealed class WorkIQAgentOptions
{
    public const string SectionName = "WorkIQAgent";

    public string SystemPrompt { get; set; } = """
        You are a Teams assistant that can use the MCP Teams tools to send messages
        to users, channels, and meetings, the MCP Mail tools to read and send emails,
        the MCP Calendar tools to manage calendar events, and the MCP Me tools to
        access user profile information.
        """;

    public int MaxHistoryMessages { get; set; } = 50;

    public string[] McpServerUrls { get; set; } =
    [
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_TeamsServer",
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_MailTools",
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_CalendarTools",
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_MeServer",
    ];
}
```

These are the four WorkIQ MCP server endpoints that expose Teams, Mail, Calendar, and Me (profile) tools.

### 1.2 Authenticated MCP Client Factory

Each MCP server requires a user-delegated token. The library's `McpClientFactory` injects `IAuthorizationHeaderProvider` and creates authenticated `McpClient` instances.

The factory exposes two key methods:

```csharp
public async Task<string> AcquireTokenAsync(
    AgenticIdentity agenticIdentity, CancellationToken cancellationToken)
{
    // Uses MSAL's IAuthorizationHeaderProvider with WithAgentUserIdentity()
    // to acquire a FIC token that represents the user (not just the app).
    // ...
}

public async Task<McpClient> CreateClientAsync(
    string serverUrl, string token, CancellationToken cancellationToken = default)
{
    return await McpClient.CreateAsync(
        new HttpClientTransport(new()
        {
            Endpoint = new Uri(serverUrl),
            Name = "WorkIQ Agent",
            AdditionalHeaders = new Dictionary<string, string>
            {
                ["Authorization"] = $"Bearer {token}"
            }
        }),
        loggerFactory: loggerFactory,
        cancellationToken: cancellationToken).ConfigureAwait(false);
}
```

Token acquisition is separated from client creation so a single token can be reused across multiple MCP server connections. The `AgenticIdentity` comes from the incoming Teams activity's `Recipient` property.

### 1.3 MCP Client Pool

Creating and tearing down MCP clients on every turn is expensive. The library's `McpClientPool` is a singleton that caches `McpClient` instances per agentic user and uses a `DelegatingHandler` to inject fresh tokens on every outbound request.

The pool is built around three components:

**`TokenHolder`** - a thread-safe container for a bearer token, shared across all MCP clients for a given user:

```csharp
internal sealed class TokenHolder
{
    private volatile string? _token;
    public string? Token => _token;
    public void SetToken(string token) => _token = token;
}
```

**`AgenticAuthHandler`** - a `DelegatingHandler` that reads from the `TokenHolder` and sets the `Authorization` header on every outbound request:

```csharp
internal sealed class AgenticAuthHandler(TokenHolder tokenHolder)
    : DelegatingHandler(new HttpClientHandler())
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (tokenHolder.Token is { } token)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return base.SendAsync(request, cancellationToken);
    }
}
```

**`McpClientPool`** - the singleton pool itself. Its `GetOrCreateAsync` method returns a cached `McpPoolEntry` (clients + discovered tools) or creates one on first access. Each call pushes the latest token into the shared `TokenHolder`:

```csharp
public async Task<McpPoolEntry> GetOrCreateAsync(
    string agenticUserId, string token, CancellationToken cancellationToken)
{
    if (_entries.TryGetValue(agenticUserId, out McpPoolEntry? entry))
    {
        entry.TokenHolder.SetToken(token);  // Refresh token for all clients
        entry.LastUsed = DateTimeOffset.UtcNow;
        return entry;
    }
    // ... create new entry with double-checked locking
}
```

When creating a new entry, the pool creates one `HttpClient` + `AgenticAuthHandler` per MCP server (all sharing the same `TokenHolder`), connects all `McpClient` instances in parallel, and discovers tools via `ListToolsAsync`.

### 1.4 The WorkIQ Agent

The `WorkIQAgent` class is the per-turn execution unit. It acquires a token, gets cached MCP tools from the pool, manages conversation history, and calls the LLM. Its `RunAsync` method is the core loop:

```csharp
public async Task<string> RunAsync(
    MessageActivity activity, CancellationToken cancellationToken)
{
    AgenticIdentity agenticIdentity = activity.Recipient.GetAgenticIdentity()
        ?? throw new InvalidOperationException("Activity recipient has no agentic identity.");

    // Acquire a fresh token once per turn (request-scoped, OBO-capable).
    string token = await _mcpClientFactory.AcquireTokenAsync(agenticIdentity, cancellationToken)
        .ConfigureAwait(false);

    // Get or create cached MCP clients; the token is pushed into the shared
    // TokenHolder so every outbound MCP HTTP request carries fresh credentials.
    McpPoolEntry poolEntry = await _mcpClientPool.GetOrCreateAsync(
        agenticIdentity.AgenticUserId!, token, cancellationToken)
        .ConfigureAwait(false);

    WorkIQAgentOptions options = _agentOptions.Value;

    List<ChatMessage> history = _historyStore.GetOrCreateHistory(
        activity.Conversation.Id,
        () => [new ChatMessage(ChatRole.System, options.SystemPrompt),]);

    // Acquire per-conversation gate to prevent interleaved mutations
    await using IAsyncDisposable gate = await _historyStore
        .AcquireGateAsync(activity.Conversation.Id, cancellationToken)
        .ConfigureAwait(false);

    // Append user message with Teams activity context
    string userText = activity.TextWithoutMentions ?? string.Empty;
    history.Add(new ChatMessage(ChatRole.User,
        $"{userText}\n\n[Turn context: {activity.ToJson()}]"));

    TrimHistory(history, options.MaxHistoryMessages);

    ChatOptions chatOptions = new()
    {
        Tools = poolEntry.Tools
    };

    ChatResponse chatResponse = await _chatClient
        .GetResponseAsync(history, chatOptions, cancellationToken)
        .ConfigureAwait(false);

    history.Add(new ChatMessage(ChatRole.Assistant, chatResponse.Text));
    return chatResponse.Text;
}
```

The conversation history store (`IConversationHistoryStore`) uses a `ConcurrentDictionary` for per-conversation history and a per-conversation `SemaphoreSlim` gate for serialization. The default `InMemoryConversationHistoryStore` is suitable for samples; for production, implement the interface with a distributed store and register it via the builder's `WithConversationHistoryStore<T>()`.

### 1.5 Service Registration (The Builder)

The library exposes a single `AddWorkIQAgent` extension method on `IHostApplicationBuilder`. It accepts an optional `Action<WorkIQAgentBuilder>` for customization:

```csharp
public static TBuilder AddWorkIQAgent<TBuilder>(
    this TBuilder hostBuilder,
    Action<WorkIQAgentBuilder>? configure = null) where TBuilder : IHostApplicationBuilder
```

The builder offers these fluent methods:

```csharp
public sealed class WorkIQAgentBuilder
{
    // Override system prompt, max history, MCP URLs in code (takes precedence over config)
    public WorkIQAgentBuilder ConfigureOptions(Action<WorkIQAgentOptions> configure);

    // Supply a custom IChatClient factory (auto-wrapped with .UseFunctionInvocation())
    public WorkIQAgentBuilder WithChatClient(Func<IServiceProvider, IChatClient> factory);

    // Replace the default InMemoryConversationHistoryStore
    public WorkIQAgentBuilder WithConversationHistoryStore<T>() where T : class, IConversationHistoryStore;

    // Enable OpenTelemetry (covered in Step 2)
    public WorkIQAgentBuilder WithOpenTelemetry(Action<WorkIQOpenTelemetryOptions>? configure = null);
}
```

Internally, `AddWorkIQAgent` registers:
- **`WorkIQAgentOptions`** - bound from the `"WorkIQAgent"` config section, with code overrides via `PostConfigure`
- **`AddAgentIdentities()`** - MSAL add-in for the FIC (Federated Identity Credential) grant
- **`IChatClient`** - default: Azure OpenAI from config with `.UseFunctionInvocation().UseOpenTelemetry()`. Custom: your factory, auto-wrapped with `.UseFunctionInvocation()`
- **`McpClientFactory`** (scoped) and **`McpClientPool`** (singleton) - authenticated MCP client infrastructure
- **`IConversationHistoryStore`** - default: `InMemoryConversationHistoryStore` (singleton)
- **`WorkIQAgent`** (scoped) - the per-turn agent

### 1.6 Teams Bot Application

Create `WorkIQTeamsBotApp.cs` in the sample project - a `TeamsBotApplication` subclass that registers a message handler in its constructor via `this.OnMessage(HandleMessageAsync)`. The handler sends a typing indicator, resolves `WorkIQAgent` from `HttpContext.RequestServices` (important: not a detached scope, so the OBO token assertion stays available to MSAL), calls `agent.RunAsync`, and replies with the result as Markdown:

```csharp
internal sealed class WorkIQTeamsBotApp : TeamsBotApplication
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public WorkIQTeamsBotApp(
        ApiClient teamsApiClient,
        IHttpContextAccessor httpContextAccessor,
        ILogger<TeamsBotApplication> logger,
        TeamsBotApplicationOptions? teamsOptions = null)
        : base(teamsApiClient, httpContextAccessor, logger, teamsOptions)
    {
        _httpContextAccessor = httpContextAccessor;
        this.OnMessage(HandleMessageAsync);
    }

    private async Task HandleMessageAsync(
        Context<MessageActivity> context, CancellationToken cancellationToken)
    {
        await context.SendTypingActivityAsync(cancellationToken);

        IServiceProvider requestServices = _httpContextAccessor.HttpContext!.RequestServices;
        WorkIQAgent agent = requestServices.GetRequiredService<WorkIQAgent>();

        string response = await agent.RunAsync(context.Activity, cancellationToken);

        TeamsActivity reply = TeamsActivity.CreateBuilder()
            .WithText(response, TextFormats.Markdown)
            .Build();

        await context.SendActivityAsync(reply, cancellationToken);
    }
}
```

### 1.7 Program Entry Point

**`Program.cs`**

```csharp
using A365TeamsAgent;
using Microsoft.Teams.Apps;
using WorkIQ.Agent;

WebApplicationBuilder builder = WebApplication.CreateSlimBuilder(args);

builder
    .AddWorkIQAgent()
    .Services
    .AddTeamsBotApplication<WorkIQTeamsBotApp>();

WebApplication app = builder.Build();
app.UseTeamsBotApplication<WorkIQTeamsBotApp>();

app.Run();
```

At this point you have a working Teams bot that responds using the LLM and can call Agent 365 MCP tools for Teams, Mail, Calendar, and Profile operations on behalf of the user.

---

## Step 2: Adding OpenTelemetry

In this step we add full observability with OpenTelemetry - distributed tracing, metrics, and structured logging - with export to OTLP, Azure Monitor, and the Agent 365 telemetry endpoint. We also add Agent 365 observability scopes to the agent for structured telemetry.

### 2.1 Enable OpenTelemetry via the Builder

The library includes OpenTelemetry support through the builder's `WithOpenTelemetry` method. Update `Program.cs` to enable it:

```diff
  using A365TeamsAgent;
  using Microsoft.Teams.Apps;
+ using Microsoft.Teams.Apps.Diagnostics;
+ using Microsoft.Teams.Core.Diagnostics;
  using WorkIQ.Agent;

+ IServiceProvider? rootServiceProvider = null;
  WebApplicationBuilder builder = WebApplication.CreateSlimBuilder(args);

  builder
-     .AddWorkIQAgent()
+     .AddWorkIQAgent(agent => agent
+         .WithOpenTelemetry(otel =>
+         {
+             otel.AdditionalActivitySources = [
+                 CoreTelemetryNames.ActivitySourceName,
+                 TeamsBotApplicationTelemetry.ActivitySourceName,
+                 "Experimental.Microsoft.Extensions.AI",
+                 "ModelContextProtocol"];
+             otel.AdditionalMeterNames = [
+                 CoreTelemetryNames.MeterName,
+                 TeamsBotApplicationTelemetry.MeterName,
+                 "Experimental.Microsoft.Extensions.AI",
+                 "ModelContextProtocol"];
+             otel.RootProviderAccessor = () => rootServiceProvider!;
+         }))
      .Services
      .AddTeamsBotApplication<WorkIQTeamsBotApp>();

  WebApplication app = builder.Build();
+ rootServiceProvider = app.Services;
  app.UseTeamsBotApplication<WorkIQTeamsBotApp>();
```

Key points:
- **`rootServiceProvider` capture**: The Agent365 telemetry exporter's `ContextualTokenResolver` needs access to DI services, but it's configured _before_ the app is built. The closure captures a variable that's assigned after `Build()`.
- **Activity sources and meters**: We subscribe to traces and metrics from the Teams SDK (`CoreTelemetryNames`, `TeamsBotApplicationTelemetry`), the AI pipeline (`Experimental.Microsoft.Extensions.AI`), and the MCP library (`ModelContextProtocol`).

### 2.2 What WithOpenTelemetry Configures

Inside the library, `WithOpenTelemetry` triggers a full OpenTelemetry setup using the `Microsoft.OpenTelemetry` distribution. The key part is the `UseMicrosoftOpenTelemetry` configuration:

```csharp
.UseMicrosoftOpenTelemetry(o =>
{
    o.Exporters = ExportTarget.Otlp | ExportTarget.AzureMonitor | ExportTarget.Agent365;
    o.Instrumentation.EnableHttpClientInstrumentation = true;
    o.Instrumentation.EnableAspNetCoreInstrumentation = true;

    // Token resolver for the Agent365 exporter (uses same MSAL infrastructure)
    if (rootProviderAccessor is not null)
    {
        o.Agent365.ContextualTokenResolver = async (ctx) =>
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(ctx.Identity.AgenticUserId);
            IAuthorizationHeaderProvider provider = rootProviderAccessor()
                .GetRequiredService<IAuthorizationHeaderProvider>();
            AuthorizationHeaderProviderOptions options = new()
            {
                AcquireTokenOptions = new()
                {
                    AuthenticationOptionsName = "AzureAd",
                    Tenant = ctx.TenantId
                }
            };
            options.WithAgentUserIdentity(ctx.Identity.AgentId,
                new Guid(ctx.Identity.AgenticUserId));
            string token = await provider.CreateAuthorizationHeaderAsync(
                ["api://9b975845-388f-4429-889e-eab1ef63949c/.default"], options);
            return token["Bearer".Length..].Trim();
        };
    }
})
```

The tracing configuration also includes a filter to suppress noisy HTTP spans from Agent 365 MCP endpoints (GET/SSE and DELETE/teardown requests that return server-side errors):

```csharp
.AddHttpClientInstrumentation(options =>
{
    options.FilterHttpRequestMessage = request =>
    {
        if (request.RequestUri?.Host is "agent365.svc.cloud.microsoft"
            && request.RequestUri.AbsolutePath.StartsWith("/agents/servers/",
                StringComparison.OrdinalIgnoreCase))
        {
            return request.Method != HttpMethod.Get && request.Method != HttpMethod.Delete;
        }
        return true;
    };
})
```

### 2.3 Agent 365 Observability Scopes

The `WorkIQAgent` emits structured Agent 365 telemetry spans using `InvokeAgentScope` (wrapping the entire agent turn) and `InferenceScope` (wrapping the LLM call), recording token usage and finish reasons:

```csharp
// Build Agent365 scope contracts from the turn context
AgentDetails agentDetails = new(
    agentId: recipient?.AgenticAppId ?? recipient?.Id,
    agentName: recipient?.Name,
    agenticUserId: recipient?.AgenticUserId,
    agentBlueprintId: recipient?.AgenticAppBlueprintId,
    tenantId: recipient?.TenantId);

Request request = new(
    content: activity.Text,
    conversationId: activity.Conversation.Id,
    channel: new Channel(activity.ChannelId));

InferenceCallDetails inferenceDetails = new(
    InferenceOperationType.Chat,
    model: options.ModelDeploymentName,
    providerName: "AzureOpenAI");

// Wrap the agent turn and LLM call in observability scopes
using InvokeAgentScope invokeScope = InvokeAgentScope.Start(request, invokeAgentScopeDetails, agentDetails);
using InferenceScope inferenceScope = InferenceScope.Start(request, inferenceDetails, agentDetails);

ChatResponse chatResponse = await _chatClient
    .GetResponseAsync(history, chatOptions, cancellationToken)
    .ConfigureAwait(false);

// Record token usage
if (chatResponse.Usage is { } usage)
{
    if (usage.InputTokenCount is { } inputTokens)
        inferenceScope.RecordInputTokens((int)inputTokens);
    if (usage.OutputTokenCount is { } outputTokens)
        inferenceScope.RecordOutputTokens((int)outputTokens);
}

inferenceScope.RecordFinishReasons([chatResponse.FinishReason?.Value ?? "stop"]);
invokeScope.RecordOutputMessages([chatResponse.Text]);
```

These scopes emit spans that the Agent 365 telemetry exporter forwards to the Agent 365 control plane, giving IT admins visibility into agent behavior, LLM usage, and tool invocations.

---

## Customization

The `WorkIQAgentBuilder` supports several customization scenarios:

```csharp
// Override the system prompt and history limit
builder.AddWorkIQAgent(agent => agent
    .ConfigureOptions(o =>
    {
        o.SystemPrompt = "You are a calendar-only assistant.";
        o.MaxHistoryMessages = 20;
    }));

// Swap the LLM provider (auto-wrapped with .UseFunctionInvocation())
builder.AddWorkIQAgent(agent => agent
    .WithChatClient(sp => new OllamaChatClient("llama3").AsIChatClient()));

// Use a distributed conversation history store
builder.AddWorkIQAgent(agent => agent
    .WithConversationHistoryStore<RedisConversationHistoryStore>());
```

Configuration can also be set via `appsettings.json`:

```json
{
  "WorkIQAgent": {
    "SystemPrompt": "You are a calendar-only assistant.",
    "MaxHistoryMessages": 30
  }
}
```

Code overrides (via `ConfigureOptions`) take precedence over `appsettings.json`.

---

## Summary

| Step | What You Get |
|------|--------------|
| 1 | MCP tool integration with client pooling - Teams, Mail, Calendar, Profile actions |
| 2 | Full observability - distributed tracing, metrics, logging via OTLP/Azure Monitor/Agent365 |

Each step builds on the previous one. The `WorkIQ.Agent` library handles all the infrastructure complexity, and the sample app stays under 15 lines.

---

## Next Steps: Manage Your Agent with Agent 365

Building your bot is just the beginning. As agents multiply across your organization - accessing documents, calling APIs, sending emails, and making decisions on behalf of users - you need a way to track, govern, and secure them at scale.

[Agent 365](https://learn.microsoft.com/en-us/microsoft-agent-365/leadership/why-agent-365-for-enterprise) is the centralized control plane for managing agents across your enterprise. It gives you:

- **Identity** - First-class agent identities with clear accountability and permissions via Microsoft Entra Agent ID.
- **Observability** - Visibility into what agents do, which systems they access, and how their behavior evolves over time.
- **Governance** - Centralized policy controls that enforce data access policies, restrict sensitive actions, and align agent behavior with compliance requirements.
- **Security** - Continuous risk management with anomalous behavior detection and high-risk action limits.
- **Lifecycle management** - Track versions, manage updates, and ensure agents remain compliant from creation to retirement.

Start building with the Teams SDK, connect your agent to Agent 365's MCP tools, add observability - and let Agent 365 handle the rest. Every agent in your organization should be registered, visible, and governed. Agent 365 is your path to scalable AI.
