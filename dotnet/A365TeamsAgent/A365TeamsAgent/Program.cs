// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using A365TeamsAgent;
using Microsoft.Teams.Apps;
using Microsoft.Teams.Apps.Diagnostics;
using Microsoft.Teams.Core.Diagnostics;
using WorkIQ.Agent;

IServiceProvider? rootServiceProvider = null;
WebApplicationBuilder builder = WebApplication.CreateSlimBuilder(args);

builder.AddWorkIQAgent(agent => agent
        .WithOpenTelemetry(otel =>
        {
            otel.AdditionalActivitySources = [
                CoreTelemetryNames.ActivitySourceName,
                TeamsBotApplicationTelemetry.ActivitySourceName,
                "Experimental.Microsoft.Extensions.AI",
                "ModelContextProtocol"];
            otel.AdditionalMeterNames = [
                CoreTelemetryNames.MeterName,
                TeamsBotApplicationTelemetry.MeterName,
                "Experimental.Microsoft.Extensions.AI",
                "ModelContextProtocol"];
            otel.RootProviderAccessor = () => rootServiceProvider!;
        }))
    .Services
    .AddTeamsBotApplication<WorkIQTeamsBotApp>();

WebApplication app = builder.Build();
rootServiceProvider = app.Services;
app.UseTeamsBotApplication<WorkIQTeamsBotApp>();

app.Run();
