// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Extensions.Logging;
using Microsoft.Identity.Abstractions;
using Microsoft.Identity.Web;
using Microsoft.Teams.Core.Schema;
using ModelContextProtocol.Client;

namespace WorkIQ.Agent;

/// <summary>
/// Creates authenticated <see cref="McpClient"/> instances using the SDK's
/// <see cref="HttpClientTransportOptions.AdditionalHeaders"/> to attach
/// user-delegated tokens to outbound MCP HTTP requests.
/// </summary>
internal sealed class McpClientFactory(
    IAuthorizationHeaderProvider authorizationHeaderProvider,
    ILoggerFactory loggerFactory)
{
    private const string WorkIQScopeForMCPServers = "ea9ffc3e-8a23-4a7d-836d-234d7c7565c1/.default";

    /// <summary>
    /// Creates an <see cref="McpClient"/> using a pre-acquired bearer token.
    /// Prefer this overload when creating multiple clients for the same identity
    /// so the token is acquired only once.
    /// </summary>
    public async Task<McpClient> CreateClientAsync(string serverUrl, string token, CancellationToken cancellationToken = default)
    {
        return await McpClient.CreateAsync(
            new HttpClientTransport(new()
            {
                Endpoint = new Uri(serverUrl),
                Name = "WorkIQ Agent",
                AdditionalHeaders = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" }
            }),
            loggerFactory: loggerFactory,
            cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Creates an <see cref="McpClient"/> by acquiring a fresh token for the given identity.
    /// When creating multiple clients for the same identity, prefer calling
    /// <see cref="AcquireTokenAsync"/> once and passing the token to <see cref="CreateClientAsync(string, string, CancellationToken)"/>.
    /// </summary>
    public async Task<McpClient> CreateClientAsync(string serverUrl, AgenticIdentity agenticIdentity, CancellationToken cancellationToken = default)
    {
        string token = await AcquireTokenAsync(agenticIdentity, cancellationToken).ConfigureAwait(false);
        return await CreateClientAsync(serverUrl, token, cancellationToken).ConfigureAwait(false);
    }

    public async Task<string> AcquireTokenAsync(AgenticIdentity agenticIdentity, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNullOrEmpty(agenticIdentity.AgenticAppId);
        ArgumentNullException.ThrowIfNullOrEmpty(agenticIdentity.AgenticUserId);

        if (!Guid.TryParse(agenticIdentity.AgenticUserId, out Guid agenticUserGuid))
        {
            throw new InvalidOperationException($"Invalid AgenticUserId '{agenticIdentity.AgenticUserId}'.");
        }

        AuthorizationHeaderProviderOptions options = new AuthorizationHeaderProviderOptions()
        {
            AcquireTokenOptions = new()
            {
                AuthenticationOptionsName = "AzureAd",
            }
        }.WithAgentUserIdentity(agenticIdentity.AgenticAppId, agenticUserGuid);

        string header = await authorizationHeaderProvider.CreateAuthorizationHeaderAsync(
            [WorkIQScopeForMCPServers], options, cancellationToken: cancellationToken).ConfigureAwait(false);

        // Strip "Bearer " prefix if present
        return header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? header["Bearer ".Length..]
            : header;
    }
}
