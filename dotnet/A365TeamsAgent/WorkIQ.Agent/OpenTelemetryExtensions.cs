// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Identity.Abstractions;
using Microsoft.Identity.Web;
using Microsoft.OpenTelemetry;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace WorkIQ.Agent;

/// <summary>
/// Extension methods for configuring OpenTelemetry with Agent365-compatible exporters.
/// </summary>
internal static class OpenTelemetryExtensions
{
    /// <summary>
    /// Configures OpenTelemetry with OTLP, Azure Monitor, and Agent365 exporters.
    /// </summary>
    /// <param name="builder">The host application builder.</param>
    /// <param name="additionalActivitySources">Extra activity source names to subscribe to beyond the defaults.</param>
    /// <param name="additionalMeterNames">Extra meter names to subscribe to beyond the defaults.</param>
    /// <param name="rootProviderAccessor">
    /// Accessor for the root <see cref="IServiceProvider"/>, needed for the Agent365
    /// contextual token resolver. Pass <c>() =&gt; rootServiceProvider</c> after building the app.
    /// </param>
    public static TBuilder ConfigureWorkIQOpenTelemetry<TBuilder>(
       this TBuilder builder,
       string[]? additionalActivitySources = null,
       string[]? additionalMeterNames = null,
       Func<IServiceProvider>? rootProviderAccessor = null) where TBuilder : IHostApplicationBuilder
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r
                .AddService(
                    serviceName: builder.Environment.ApplicationName,
                    serviceVersion: "0.0.1")
                .AddAttributes(new Dictionary<string, object>
                {
                    ["service.namespace"] = "TeamsSamples"
                }))
            .UseMicrosoftOpenTelemetry(o =>
            {
                o.Exporters = ExportTarget.Otlp | ExportTarget.AzureMonitor | ExportTarget.Agent365;
                o.Instrumentation.EnableHttpClientInstrumentation = true;
                o.Instrumentation.EnableAspNetCoreInstrumentation = true;

                if (rootProviderAccessor is not null)
                {
                    o.Agent365.ContextualTokenResolver = async (ctx) =>
                    {
                        ArgumentException.ThrowIfNullOrWhiteSpace(ctx.Identity.AgenticUserId);
                        IAuthorizationHeaderProvider provider = rootProviderAccessor().GetRequiredService<IAuthorizationHeaderProvider>();
                        AuthorizationHeaderProviderOptions options = new() { AcquireTokenOptions = new() { AuthenticationOptionsName = "AzureAd", Tenant = ctx.TenantId } };
                        options.WithAgentUserIdentity(ctx.Identity.AgentId, new Guid(ctx.Identity.AgenticUserId));
                        string token = await provider.CreateAuthorizationHeaderAsync(
                            ["api://9b975845-388f-4429-889e-eab1ef63949c/.default"], options);
                        return token["Bearer".Length..].Trim();
                    };
                }
            })
            .WithMetrics(metrics =>
            {
                metrics.AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation();

                if (additionalMeterNames is { Length: > 0 })
                {
                    metrics.AddMeter(additionalMeterNames);
                }
            })
            .WithTracing(tracing =>
            {
                tracing.AddSource(builder.Environment.ApplicationName)
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation(options =>
                    {
                        // Suppress known-noisy spans from Agent365 MCP service endpoints.
                        options.FilterHttpRequestMessage = request =>
                        {
                            if (request.RequestUri?.Host is "agent365.svc.cloud.microsoft"
                                && request.RequestUri.AbsolutePath.StartsWith("/agents/servers/", StringComparison.OrdinalIgnoreCase))
                            {
                                return request.Method != HttpMethod.Get
                                    && request.Method != HttpMethod.Delete;
                            }

                            return true;
                        };
                    });

                if (additionalActivitySources is { Length: > 0 })
                {
                    tracing.AddSource(additionalActivitySources);
                }
            });

        return builder;
    }
}
