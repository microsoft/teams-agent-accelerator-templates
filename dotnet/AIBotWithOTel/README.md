# AIBot with OpenTelemetry

A Microsoft Teams bot built with .NET 10, the [Teams AI Library](https://www.nuget.org/packages/Microsoft.Teams.Apps), and [Microsoft.Extensions.AI](https://www.nuget.org/packages/Microsoft.Extensions.AI) that answers questions using Azure OpenAI and the [Microsoft Learn MCP server](https://learn.microsoft.com/api/mcp). All AI interactions are instrumented with OpenTelemetry so you can trace every LLM call and tool invocation.

## Architecture

```
User  ──>  Teams  ──>  AIBot  ──>  Azure OpenAI (IChatClient)
                                        │
                                        ├── FunctionInvocationMiddleware
                                        │        │
                                        │        └── MCP Tools (Microsoft Learn)
                                        │
                                        └── OpenTelemetry Middleware
                                                 │
                                                 ├── OTLP Exporter (Aspire Dashboard / Jaeger / etc.)
                                                 └── Azure Monitor (Application Insights)
```

The solution is structured as an [.NET Aspire](https://learn.microsoft.com/dotnet/aspire/get-started/aspire-overview) application:

| Project | Purpose |
|---------|---------|
| **AIBot** | The Teams bot. Configures the `IChatClient` pipeline, connects to the MCP server, and handles messages. |
| **AIBotWithOTel.AppHost** | Aspire orchestrator. Launches the bot and any dependent resources. |
| **AIBotWithOTel.ServiceDefaults** | Shared configuration for OpenTelemetry, health checks, resilience, and service discovery. |

## Key concepts

- **`IChatClient` pipeline** &mdash; Azure OpenAI is wrapped with `UseFunctionInvocation()` (to automatically call MCP tools) and `UseOpenTelemetry()` (to emit traces and metrics).
- **MCP (Model Context Protocol)** &mdash; The bot connects to `https://learn.microsoft.com/api/mcp` at startup, discovers available tools, and passes them to the LLM on every request. The LLM can call these tools to search and retrieve Microsoft documentation.
- **OpenTelemetry** &mdash; Traces and metrics are exported via OTLP (e.g. to the Aspire Dashboard) and optionally to Azure Monitor / Application Insights.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- An Azure OpenAI resource with a chat model deployed
- A [Teams bot registration](https://learn.microsoft.com/microsoftteams/platform/bots/how-to/authentication/bot-sso-register-aad) (AAD app with Bot Channel)
- (Optional) [Dev Proxy](https://learn.microsoft.com/microsoft-cloud/dev/dev-proxy/overview) or [Teams Toolkit](https://learn.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals) for local testing

## Getting started

### 1. Clone and configure

Copy the launch settings template and fill in your values:

```bash
cp AIBot/Properties/launchSettings.TEMPLATE.json AIBot/Properties/launchSettings.json
```

Edit `AIBot/Properties/launchSettings.json` and set:

| Variable | Description |
|----------|-------------|
| `AzureAd__TenantId` | Your AAD tenant ID |
| `AzureAd__ClientId` | The bot's AAD app (client) ID |
| `AzureAd__ClientCredentials__0__ClientSecret` | The bot's client secret |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint (e.g. `https://myresource.openai.azure.com`) |
| `AZURE_OPENAI_KEY` | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name (e.g. `gpt-4o`) |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | (Optional) Application Insights connection string |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (Optional) OTLP collector endpoint (e.g. `http://localhost:4317`) |

### 2. Run

```bash
# Run just the bot
dotnet run --project AIBot

# Or run via Aspire (includes dashboard at https://localhost:15888)
dotnet run --project AIBotWithOTel.AppHost
```

The bot listens on `http://localhost:3978` by default.

### 3. Test locally

Use the [Bot Framework Emulator](https://github.com/microsoft/BotFramework-Emulator) or [Teams Toolkit](https://learn.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals) to send messages to `http://localhost:3978/api/messages`.

## Observability

The `ServiceDefaults` project configures OpenTelemetry with:

- **Traces** from ASP.NET Core, HttpClient, `Microsoft.Extensions.AI`, and `ModelContextProtocol`
- **Metrics** from ASP.NET Core, HttpClient, .NET runtime, Teams bot library, AI client, and MCP
- **Logs** forwarded to OpenTelemetry with formatted messages and scopes

When running via the Aspire AppHost, the built-in dashboard shows all traces, metrics, and logs. You can also export to any OTLP-compatible backend (Jaeger, Grafana, etc.) or to Azure Monitor by setting the `APPLICATIONINSIGHTS_CONNECTION_STRING`.
