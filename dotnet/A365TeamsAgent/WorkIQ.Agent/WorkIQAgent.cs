// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Agents.A365.Observability.Runtime.Tracing.Contracts;
using Microsoft.Agents.A365.Observability.Runtime.Tracing.Scopes;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using Microsoft.Teams.Apps.Schema;
using Microsoft.Teams.Core.Schema;

namespace WorkIQ.Agent;

/// <summary>
/// Per-turn agent that obtains cached MCP tools from <see cref="McpClientPool"/>,
/// replays the conversation through an <see cref="IChatClient"/>, and returns the
/// assistant's reply. Conversation history is owned by <see cref="IConversationHistoryStore"/>
/// so this type can safely be registered as a scoped service.
/// </summary>
public class WorkIQAgent
{
    private readonly IChatClient _chatClient;
    private readonly McpClientFactory _mcpClientFactory;
    private readonly McpClientPool _mcpClientPool;
    private readonly IConversationHistoryStore _historyStore;
    private readonly IOptions<WorkIQAgentOptions> _agentOptions;

    internal WorkIQAgent(
        IChatClient chatClient,
        McpClientFactory mcpClientFactory,
        McpClientPool mcpClientPool,
        IConversationHistoryStore historyStore,
        IOptions<WorkIQAgentOptions> agentOptions)
    {
        _chatClient = chatClient;
        _mcpClientFactory = mcpClientFactory;
        _mcpClientPool = mcpClientPool;
        _historyStore = historyStore;
        _agentOptions = agentOptions;
    }

    public async Task<string> RunAsync(
       MessageActivity activity,
       CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrEmpty(activity.Conversation?.Id);
        ArgumentNullException.ThrowIfNull(activity.Recipient);

        AgenticIdentity agenticIdentity = activity.Recipient.GetAgenticIdentity()
            ?? throw new InvalidOperationException("Activity recipient has no agentic identity.");

        // Acquire a fresh token once per turn (request-scoped, OBO-capable).
        string token = await _mcpClientFactory.AcquireTokenAsync(agenticIdentity, cancellationToken).ConfigureAwait(false);

        // Get or create cached MCP clients; the token is pushed into the shared
        // TokenHolder so every outbound MCP HTTP request carries fresh credentials.
        McpPoolEntry poolEntry = await _mcpClientPool.GetOrCreateAsync(
            agenticIdentity.AgenticUserId!, token, cancellationToken).ConfigureAwait(false);

        WorkIQAgentOptions options = _agentOptions.Value;

        // === InferenceScope: wraps the LLM + tool-call loop ===
        InferenceCallDetails inferenceDetails = new(
            InferenceOperationType.Chat,
            model: options.ModelDeploymentName,
            providerName: "AzureOpenAI");

        List<ChatMessage> history = _historyStore.GetOrCreateHistory(
            activity.Conversation.Id,
            () => [new ChatMessage(ChatRole.System, options.SystemPrompt),]);

        // Serialize turns within a single conversation so concurrent submits
        // (e.g. clarification race) don't interleave history mutations.
        await using IAsyncDisposable gate = await _historyStore.AcquireGateAsync(activity.Conversation.Id, cancellationToken).ConfigureAwait(false);

        string userText = activity.TextWithoutMentions ?? string.Empty;
        history.Add(new ChatMessage(ChatRole.User, $"{userText}\n\n[Turn context: {activity.ToJson()}]"));

        TrimHistory(history, options.MaxHistoryMessages);

        ChatOptions chatOptions = new()
        {
            Tools = poolEntry.Tools
        };

        // Build Agent365 scope contracts from the turn context.
        TeamsConversationAccount? recipient = activity.Recipient;
        AgentDetails agentDetails = new(
            agentId: recipient?.AgenticAppId ?? recipient?.Id,
            agentName: recipient?.Name,
            agenticUserId: recipient?.AgenticUserId,
            agentBlueprintId: recipient?.AgenticAppBlueprintId,
            tenantId: recipient?.TenantId);

        Request request = new(
            content: activity.TextWithoutMentions,
            conversationId: activity.Conversation.Id,
            channel: new Channel(activity.ChannelId));

        // === InvokeAgentScope: wraps the entire agent turn ===
        InvokeAgentScopeDetails invokeAgentScopeDetails = new(activity.ServiceUrl);
        using InvokeAgentScope invokeScope = InvokeAgentScope.Start(request, invokeAgentScopeDetails, agentDetails);
        using InferenceScope inferenceScope = InferenceScope.Start(request, inferenceDetails, agentDetails);

        ChatResponse chatResponse = await _chatClient.GetResponseAsync(history, chatOptions, cancellationToken).ConfigureAwait(false);

        history.Add(new ChatMessage(ChatRole.Assistant, chatResponse.Text));

        if (chatResponse.Usage is { } usage)
        {
            if (usage.InputTokenCount is { } inputTokens)
                inferenceScope.RecordInputTokens((int)inputTokens);
            if (usage.OutputTokenCount is { } outputTokens)
                inferenceScope.RecordOutputTokens((int)outputTokens);
        }

        string finishReason = chatResponse.FinishReason?.Value ?? "stop";
        inferenceScope.RecordFinishReasons([finishReason]);

        invokeScope.RecordOutputMessages([chatResponse.Text]);
        return chatResponse.Text;
    }

    /// <summary>
    /// Keeps the first message (system prompt) and trims the oldest non-system messages
    /// when the history exceeds the configured limit.
    /// </summary>
    private static void TrimHistory(List<ChatMessage> history, int maxMessages)
    {
        // index 0 is the system prompt; everything after is conversation messages.
        int conversationCount = history.Count - 1;
        if (conversationCount <= maxMessages)
        {
            return;
        }

        int excess = conversationCount - maxMessages;
        history.RemoveRange(1, excess);
    }
}
