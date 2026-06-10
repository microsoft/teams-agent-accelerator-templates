# OTelBotWithAspire

A Microsoft Teams echo bot built with the [Teams Apps SDK](https://www.nuget.org/packages/Microsoft.Teams.Apps) and [.NET Aspire](https://learn.microsoft.com/dotnet/aspire/), showcasing how to add comprehensive OpenTelemetry observability to a Teams bot from day one.

## Architecture

```
OTelBotWithAspire.slnx
├── OTelBot/                          # The Teams bot (ASP.NET Core)
├── OTelBotWithAspire.AppHost/        # Aspire orchestrator & dashboard
└── OTelBotWithAspire.ServiceDefaults/ # Shared OpenTelemetry, health checks & resilience config
```

| Project | Role |
|---------|------|
| **OTelBot** | Hosts the bot on `http://localhost:3978`. Receives messages from Teams and echoes them back. |
| **AppHost** | Aspire orchestration project. Starts all services and exposes the Aspire dashboard on `http://localhost:15084` for traces, metrics, and logs. |
| **ServiceDefaults** | Shared library that wires up OpenTelemetry (OTLP + Azure Monitor), health checks (`/health`, `/alive`), service discovery, and HTTP resilience for every service in the solution. |

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- A [Teams bot registration](https://learn.microsoft.com/microsoftteams/platform/bots/how-to/authentication/bot-sso-register-aad) (Azure AD app with Teams channel enabled)
- A tunneling tool such as [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/) or [ngrok](https://ngrok.com/) to expose your local bot endpoint to Teams

## Getting Started

### 1. Configure credentials

Copy the launch-settings template and fill in your Azure AD values:

```bash
cp OTelBot/Properties/launchSettings.TEMPLATE.json OTelBot/Properties/launchSettings.json
```

Then edit `launchSettings.json` and set:

| Variable | Description |
|----------|-------------|
| `AzureAd__TenantId` | Your Azure AD tenant ID |
| `AzureAd__ClientId` | The bot's Azure AD app (client) ID |
| `AzureAd__ClientCredentials__0__ClientSecret` | The app's client secret |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | *(Optional)* Application Insights connection string |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint (defaults to `http://localhost:4317`) |

### 2. Run with Aspire (recommended)

```bash
cd OTelBotWithAspire.AppHost
dotnet run
```

This starts the bot and opens the **Aspire dashboard** at `http://localhost:15084`, where you can inspect distributed traces, metrics, and structured logs in real time — no external collector required.

### 3. Run the bot standalone

If you don't need the Aspire dashboard:

```bash
cd OTelBot
dotnet run
```

The bot listens on `http://localhost:3978`.

### 4. Expose the bot to Teams

Use Dev Tunnels or ngrok to tunnel traffic to `http://localhost:3978`, then set the tunnel URL as the messaging endpoint in your Bot Framework registration (e.g. `https://<tunnel-id>.devtunnels.ms/api/messages`).

## Observability

The **ServiceDefaults** project configures OpenTelemetry for all services automatically via `builder.AddServiceDefaults()`:

| Signal | What's collected |
|--------|-----------------|
| **Traces** | ASP.NET Core requests, HTTP client calls, Teams SDK activity sources |
| **Metrics** | ASP.NET Core, HTTP client, .NET runtime, Teams SDK meters |
| **Logs** | Structured logs with scopes and formatted messages |

Telemetry is exported via:

- **OTLP** — when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (Aspire dashboard, Jaeger, Grafana, etc.)
- **Azure Monitor** — when `APPLICATIONINSIGHTS_CONNECTION_STRING` is set

Health checks are available in Development at `/health` (readiness) and `/alive` (liveness).

## Project Details

- **Target framework:** .NET 10.0
- **Teams SDK:** `Microsoft.Teams.Apps` 2.1.0-preview
- **Aspire SDK:** 13.1.2
