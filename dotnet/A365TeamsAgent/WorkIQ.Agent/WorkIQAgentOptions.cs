// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

namespace WorkIQ.Agent;

/// <summary>
/// Configuration options for the <see cref="WorkIQAgent"/>, including
/// the MCP server endpoints to connect to, the system prompt, and history limits.
/// </summary>
public sealed class WorkIQAgentOptions
{
    public const string SectionName = "WorkIQAgent";

    /// <summary>
    /// The system prompt sent as the first message in every conversation.
    /// </summary>
    public string SystemPrompt { get; set; } = """
        You are a Teams assistant that can use the MCP Teams tools to send messages to users, channels, and meetings,
        the MCP Mail tools to read and send emails, the MCP Calendar tools to manage calendar events,
        and the MCP Me tools to access user profile information.
        """;

    /// <summary>
    /// Maximum number of non-system messages retained per conversation. When exceeded the
    /// oldest messages (after the system prompt) are trimmed.
    /// </summary>
    public int MaxHistoryMessages { get; set; } = 50;

    /// <summary>
    /// The MCP server URLs the agent connects to for tool discovery.
    /// </summary>
    public string[] McpServerUrls { get; set; } =
    [
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_TeamsServer",
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_MailTools",
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_CalendarTools",
        "https://agent365.svc.cloud.microsoft/agents/servers/mcp_MeServer",
    ];

    /// <summary>
    /// The model deployment name used for telemetry. Set automatically when using
    /// the default AzureOpenAI chat client; override when supplying a custom client.
    /// </summary>
    public string ModelDeploymentName { get; set; } = string.Empty;
}
