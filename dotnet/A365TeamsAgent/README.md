# Agent 365 Teams Agent

A Microsoft Teams bot sample that participates in the [Microsoft Agent 365](https://learn.microsoft.com/microsoft-agent-365/) ecosystem using the [Teams Apps SDK](https://www.nuget.org/packages/Microsoft.Teams.Apps). The sample shows how to build an Agent 365-aware bot without taking a direct dependency on an Agent 365 SDK: it uses Entra-backed agent identity, Work IQ MCP tools, Azure OpenAI, and OpenTelemetry-compatible observability.

The solution is split into a reusable agent library and a minimal Teams bot host so you can copy the infrastructure into your own bot or customize only the application layer.

## Architecture

```text
A365TeamsAgent.slnx
|-- WorkIQ.Agent\              # Reusable agent infrastructure
|   |-- WorkIQAgent.cs          # Per-turn LLM + MCP tool orchestration
|   |-- WorkIQAgentOptions.cs   # System prompt, history, and MCP server settings
|   |-- McpClientFactory.cs     # Agentic user token acquisition and MCP clients
|   |-- McpClientPool.cs        # Cached MCP clients per agentic user
|   |-- IConversationHistoryStore.cs
|   `-- OpenTelemetryExtensions.cs
|
`-- A365TeamsAgent\            # ASP.NET Core Teams bot host
    |-- Program.cs              # Service registration and telemetry setup
    |-- WorkIQTeamsBotApp.cs    # Teams message handler
    |-- appsettings.json
    `-- Properties\launchSettings.TEMPLATE.json
```

| Project | Role |
| --- | --- |
| **WorkIQ.Agent** | Registers the chat client, acquires delegated Agent 365 tokens, connects to Work IQ MCP servers, manages conversation history, and emits Agent 365-compatible telemetry scopes. |
| **A365TeamsAgent** | Hosts the Teams bot on ASP.NET Core, wires the bot handler, sends typing indicators, invokes `WorkIQAgent`, and replies with Markdown. |

## What this sample demonstrates

- **Agent 365 identity flow**: uses Entra agent identity and user-delegated tokens for MCP calls.
- **Work IQ MCP integration**: connects to Teams, Mail, Calendar, and Me MCP servers.
- **Azure OpenAI chat orchestration**: uses `Microsoft.Extensions.AI` with function invocation for MCP tools.
- **Per-conversation memory**: keeps bounded in-memory chat history by Teams conversation ID.
- **Observability**: configures OpenTelemetry sources, meters, and Agent 365 telemetry scopes for agent turns and inference calls.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- An Azure OpenAI resource with a deployed chat model
- An Azure AD app registration configured for a Teams bot and Agent 365 identity
- A Microsoft 365 tenant where you can install or sideload Teams apps
- A tunneling tool such as [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/) or ngrok to expose the local bot endpoint

For the Agent 365 setup flow, start with [Get started with Agent 365 development](https://learn.microsoft.com/microsoft-agent-365/developer/get-started).

## Getting started

### 1. Configure local settings

Copy the checked-in launch profile template and fill in your own values:

```powershell
Copy-Item .\A365TeamsAgent\Properties\launchSettings.TEMPLATE.json .\A365TeamsAgent\Properties\launchSettings.json
```

Then update `A365TeamsAgent\Properties\launchSettings.json`:

| Variable | Description |
| --- | --- |
| `AzureAd__TenantId` | Tenant ID for the Azure AD app registration |
| `AzureAd__ClientId` | Client ID for the Teams bot app registration |
| `AzureAd__ClientCredentials__0__ClientSecret` | Client secret for local development |
| `AzureOpenAI__Endpoint` | Azure OpenAI endpoint, for example `https://<resource>.openai.azure.com/` |
| `AzureOpenAI__ApiKey` | Azure OpenAI API key |
| `AzureOpenAI__ModelId` | Azure OpenAI deployment name to use for chat completions |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Optional Application Insights connection string for telemetry export |

Do not commit real secrets. Prefer user secrets, environment variables, or your local launch profile for development credentials.

### 2. Restore and build

```powershell
dotnet restore .\A365TeamsAgent.slnx
dotnet build .\A365TeamsAgent.slnx
```

### 3. Run the bot

```powershell
dotnet run --project .\A365TeamsAgent\A365TeamsAgent.csproj
```

The bot listens on `http://localhost:3978` by default.

### 4. Expose the endpoint to Teams

Start a tunnel to `http://localhost:3978`, then set the bot messaging endpoint in your Teams/Bot Framework registration to:

```text
https://<your-tunnel-host>/api/messages
```

Install or sideload the Teams app in your tenant, then send the bot a message in Teams.

## Configuration

`WorkIQ.Agent` reads options from the `WorkIQAgent` configuration section and lets code-based builder overrides take precedence.

```json
{
  "WorkIQAgent": {
    "SystemPrompt": "You are a helpful Teams assistant.",
    "MaxHistoryMessages": 50,
    "McpServerUrls": [
      "https://agent365.svc.cloud.microsoft/agents/servers/mcp_TeamsServer",
      "https://agent365.svc.cloud.microsoft/agents/servers/mcp_MailTools",
      "https://agent365.svc.cloud.microsoft/agents/servers/mcp_CalendarTools",
      "https://agent365.svc.cloud.microsoft/agents/servers/mcp_MeServer"
    ]
  }
}
```

The default MCP servers expose Teams, Mail, Calendar, and user profile tools. Override `McpServerUrls` only when you need a different MCP surface.

## Customization points

| Need | Where to change it |
| --- | --- |
| Change the agent behavior | Update `WorkIQAgent:SystemPrompt` in configuration or configure `WorkIQAgentOptions` in `Program.cs`. |
| Use a different chat client | Pass a custom chat client factory to `builder.AddWorkIQAgent(...)` in `Program.cs`. |
| Persist conversation history | Implement `IConversationHistoryStore` and register it through the `WorkIQAgentBuilder`. |
| Add or remove MCP servers | Override `WorkIQAgent:McpServerUrls`. |
| Change the Teams interaction | Update `A365TeamsAgent\WorkIQTeamsBotApp.cs`. |
| Tune telemetry | Update `.WithOpenTelemetry(...)` in `A365TeamsAgent\Program.cs`. |

## Observability

OpenTelemetry is enabled in `Program.cs` through `WithOpenTelemetry`. The template subscribes to Teams SDK, `Microsoft.Extensions.AI`, and Model Context Protocol sources and meters, then exports through Microsoft OpenTelemetry exporters when the relevant environment is configured.

The agent records:

- An Agent 365 invoke-agent scope for each Teams turn
- An inference scope around the Azure OpenAI and MCP tool-call loop
- Input and output token counts when the model response includes usage
- Finish reasons and final assistant output metadata

Set `APPLICATIONINSIGHTS_CONNECTION_STRING` to export telemetry to Azure Monitor. Local collector support can be added with standard OpenTelemetry environment variables if your environment uses OTLP.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `AzureOpenAI:Endpoint is required` | Set `AzureOpenAI__Endpoint`, `AzureOpenAI__ApiKey`, and `AzureOpenAI__ModelId` in local configuration. |
| First turn fails during token acquisition | Confirm the request is running through the ASP.NET Core request scope and that the Azure AD app registration supports the Agent 365 identity flow. |
| MCP tools are unavailable | Verify the signed-in user and tenant have access to the Agent 365 Work IQ MCP servers. |
| Teams cannot reach the bot | Confirm the tunnel is running and the messaging endpoint points to `/api/messages`. |
| Telemetry is missing | Set `APPLICATIONINSIGHTS_CONNECTION_STRING` and verify the app can reach Azure Monitor ingestion. |

## Learn more

- [Tutorial: Building a Teams Bot Agent with Agent 365](TUTORIAL.md)
- [Microsoft Agent 365 documentation](https://learn.microsoft.com/microsoft-agent-365/)
- [Teams Apps SDK package](https://www.nuget.org/packages/Microsoft.Teams.Apps)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [OpenTelemetry](https://opentelemetry.io/)
