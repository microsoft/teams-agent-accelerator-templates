// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ModelContextProtocol.Client;
using System.Collections.Concurrent;
using System.Net.Http.Headers;

namespace WorkIQ.Agent;

/// <summary>
/// Holds a bearer token that can be swapped atomically. Shared by every
/// <see cref="AgenticAuthHandler"/> belonging to the same agentic user so
/// a single <see cref="McpClientFactory.AcquireTokenAsync"/> call
/// refreshes all outbound MCP requests.
/// </summary>
internal sealed class TokenHolder
{
    private volatile string? _token;
    public string? Token => _token;
    public void SetToken(string token) => _token = token;
}

/// <summary>
/// A <see cref="DelegatingHandler"/> that injects the current bearer token
/// from a shared <see cref="TokenHolder"/> into every outbound HTTP request.
/// One instance per <see cref="HttpClient"/> (i.e. per MCP server per user).
/// </summary>
internal sealed class AgenticAuthHandler(TokenHolder tokenHolder) : DelegatingHandler(new HttpClientHandler())
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (tokenHolder.Token is { } token)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return base.SendAsync(request, cancellationToken);
    }
}

/// <summary>
/// A cached set of <see cref="McpClient"/> instances and their discovered tools
/// for a single agentic user. The <see cref="TokenHolder"/> is shared across all
/// clients so a single token refresh applies to every MCP server.
/// </summary>
internal sealed class McpPoolEntry : IAsyncDisposable
{
    public required McpClient[] Clients { get; init; }
    public required List<AITool> Tools { get; init; }
    public required TokenHolder TokenHolder { get; init; }

    /// <summary>Tracks when this entry was last used for idle eviction.</summary>
    public DateTimeOffset LastUsed { get; set; } = DateTimeOffset.UtcNow;

    public async ValueTask DisposeAsync()
    {
        foreach (McpClient client in Clients)
        {
            try
            {
                await client.DisposeAsync().ConfigureAwait(false);
            }
            catch
            {
                // Best-effort cleanup — don't mask the caller's exception.
            }
        }
    }
}

/// <summary>
/// Singleton pool that caches <see cref="McpClient"/> instances per agentic user.
/// Clients are created once (on first use) and reused across turns. A
/// <see cref="DelegatingHandler"/>-based <see cref="AgenticAuthHandler"/> injects
/// a fresh bearer token on every outbound HTTP request so the long-lived transport
/// never holds a stale credential.
/// </summary>
internal sealed class McpClientPool(
    IOptions<WorkIQAgentOptions> options,
    ILoggerFactory loggerFactory) : IAsyncDisposable
{
    private readonly ConcurrentDictionary<string, McpPoolEntry> _entries = new();
    private readonly SemaphoreSlim _createLock = new(1, 1);

    /// <summary>
    /// Returns a cached pool entry (clients + tools) for the given agentic user,
    /// creating one if none exists. The caller must supply a current bearer token
    /// which is pushed into the entry's <see cref="TokenHolder"/> so subsequent
    /// MCP HTTP requests carry fresh credentials.
    /// </summary>
    public async Task<McpPoolEntry> GetOrCreateAsync(
        string agenticUserId,
        string token,
        CancellationToken cancellationToken)
    {
        if (_entries.TryGetValue(agenticUserId, out McpPoolEntry? entry))
        {
            entry.TokenHolder.SetToken(token);
            entry.LastUsed = DateTimeOffset.UtcNow;
            return entry;
        }

        await _createLock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            // Double-check after acquiring the lock.
            if (_entries.TryGetValue(agenticUserId, out entry))
            {
                entry.TokenHolder.SetToken(token);
                entry.LastUsed = DateTimeOffset.UtcNow;
                return entry;
            }

            entry = await CreateEntryAsync(token, cancellationToken).ConfigureAwait(false);
            _entries[agenticUserId] = entry;
            return entry;
        }
        finally
        {
            _createLock.Release();
        }
    }

    /// <summary>
    /// Removes and disposes the pool entry for the given user. Useful when a client
    /// encounters an unrecoverable transport error and needs a fresh connection.
    /// </summary>
    public async ValueTask EvictAsync(string agenticUserId)
    {
        if (_entries.TryRemove(agenticUserId, out McpPoolEntry? entry))
        {
            await entry.DisposeAsync().ConfigureAwait(false);
        }
    }

    private async Task<McpPoolEntry> CreateEntryAsync(
        string token,
        CancellationToken cancellationToken)
    {
        string[] serverUrls = options.Value.McpServerUrls;
        TokenHolder tokenHolder = new();
        tokenHolder.SetToken(token);

        // Each MCP server gets its own HttpClient + handler, all sharing one TokenHolder.
        McpClient[] clients = new McpClient[serverUrls.Length];
        HttpClient[] httpClients = new HttpClient[serverUrls.Length];

        try
        {
            Task<McpClient>[] tasks = new Task<McpClient>[serverUrls.Length];
            for (int i = 0; i < serverUrls.Length; i++)
            {
                AgenticAuthHandler handler = new(tokenHolder);
                httpClients[i] = new HttpClient(handler);

                tasks[i] = McpClient.CreateAsync(
                    new HttpClientTransport(
                        new HttpClientTransportOptions
                        {
                            Endpoint = new Uri(serverUrls[i]),
                            Name = "WorkIQ Agent",
                        },
                        httpClients[i],
                        loggerFactory),
                    loggerFactory: loggerFactory,
                    cancellationToken: cancellationToken);
            }

            McpClient[] results = await Task.WhenAll(tasks).ConfigureAwait(false);
            Array.Copy(results, clients, results.Length);
        }
        catch
        {
            // Roll back: dispose any successfully-created clients and HttpClients.
            foreach (McpClient? c in clients)
            {
                if (c is not null)
                {
                    try { await c.DisposeAsync().ConfigureAwait(false); }
                    catch { }
                }
            }

            foreach (HttpClient? hc in httpClients)
            {
                hc?.Dispose();
            }

            throw;
        }

        // Discover tools from all servers in parallel.
        IList<McpClientTool>[] toolLists = await Task.WhenAll(
            clients.Select(c =>
                c.ListToolsAsync(cancellationToken: cancellationToken).AsTask())).ConfigureAwait(false);

        List<AITool> tools = [.. toolLists.SelectMany(t => t)];

        return new McpPoolEntry
        {
            Clients = clients,
            Tools = tools,
            TokenHolder = tokenHolder,
        };
    }

    public async ValueTask DisposeAsync()
    {
        foreach (McpPoolEntry entry in _entries.Values)
        {
            await entry.DisposeAsync().ConfigureAwait(false);
        }

        _entries.Clear();
        _createLock.Dispose();
    }
}
