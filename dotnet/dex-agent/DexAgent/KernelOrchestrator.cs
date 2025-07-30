using System.Text;
using System.Text.Json;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Microsoft.Teams.Api.Activities;
using Microsoft.Teams.Apps;
using Microsoft.Teams.Common.Storage;

namespace DexAgent
{
    public class KernelOrchestrator
    {
        private Kernel _kernel;
        private IChatCompletionService _chatCompletionService;
        private OpenAIPromptExecutionSettings _openAIPromptExecutionSettings;
        private LocalStorage<object> _storage;
        private ConfigOptions _config;

        /// <summary>
        /// Used to manage the chat history and
        /// orchestrate the text-based conversations
        /// </summary>
        /// <param name="kernel">The kernel</param>
        /// <param name="storage">The storage</param>
        /// <param name="config">The configuration pairs</param>
        public KernelOrchestrator(Kernel kernel, LocalStorage<object> storage, ConfigOptions config)
        {
            _kernel = kernel;
            _chatCompletionService = kernel.GetRequiredService<IChatCompletionService>();

#pragma warning disable SKEXP0010 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
            _openAIPromptExecutionSettings = new()
            {
//// ResponseFormat = "json_object",
                FunctionChoiceBehavior = FunctionChoiceBehavior.Auto(),
                Temperature = 0,
            };
#pragma warning restore SKEXP0010 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
            _storage = storage;
            _config = config;
        }

        /// <summary>
        /// Initializes the chat history for a new conversation
        /// and sets up the system message to instruct the model
        /// </summary>
        /// <param name="activity">The activity</param>
        /// <returns></returns>
        public ConversationInfo InitiateChat(Activity activity)
        {
            ChatHistory chatHistory = new();
            chatHistory.AddSystemMessage(
                    "You are a GitHub Assistant. " +
                    "Respond in plain English. " +
                    "You can list pull requests. " +
                    "You send an adaptive card whenever there is a new assignee on a pull request. " +
                    "You send an adaptive card whenever there is a status update on a pull request. " +
                    "All of the pull requests are in the Teams AI SDK repository. " +
                    "The purpose of GitHub Assistant is to help boost the team's productivity and quality of their engineering lifecycle.");

            string serializedHistory = JsonSerializer.Serialize(chatHistory);

            ConversationInfo convo = new ConversationInfo()
            {
                BotId = _config.ClientId,
                Id = activity.Conversation.Id,
                ServiceUrl = activity.ServiceUrl,
                ChatHistory = serializedHistory,
                IsGroup = (activity.Conversation.IsGroup != null) ? (bool)activity.Conversation.IsGroup : false,
            };

            if (string.Equals(activity.Conversation.Type, "channel"))
            {
                convo.ChannelId = activity.ChannelData?.Channel?.Id;
            }

            return convo;
        }

        /// <summary>
        /// Creates and adds to the chat history for the current turn
        /// </summary>
        /// <param name="context">The context</param>
        /// <returns></returns>
        public async Task CreateChatHistory(IContext<Activity> context, string activity, AuthorRole authorRole)
        {
            List<ConversationInfo> prevConvos = await GetPreviousConvos();
            ConversationInfo? currConvo = prevConvos.Find(x => x.Id == context.Activity.Conversation.Id);

            if (currConvo == null)
            {
                currConvo = InitiateChat(context.Activity);
            }
            else
            {
                prevConvos.Remove(currConvo);
            }

            ChatHistory? history = JsonSerializer.Deserialize<ChatHistory>(currConvo.ChatHistory ?? string.Empty);
            history.AddMessage(authorRole, activity);
            await SerializeAndSaveHistory(history, currConvo, prevConvos);
        }

        /// <summary>
        /// Saves the activity to the chat history
        /// </summary>
        /// <param name="context">The turn context</param>
        /// <param name="activity">The activity text associated to the turn</param>
        /// <returns></returns>
        public async Task SaveActivityToChatHistory(IContext<Activity> context, string? activity)
        {
            List<ConversationInfo> prevConvos = await GetPreviousConvos();
            ConversationInfo? currConvo = prevConvos.Find(x => x.Id == context.Activity.Conversation.Id);
            prevConvos.Remove(currConvo ?? throw new InvalidOperationException("Conversation not found"));

            ChatHistory? history = JsonSerializer.Deserialize<ChatHistory>(currConvo.ChatHistory ?? string.Empty);
            history.AddAssistantMessage(activity ?? string.Empty);
            await SerializeAndSaveHistory(history, currConvo, prevConvos);
        }

        /// <summary>
        /// Serializes the chat history and saves it to storage
        /// </summary>
        /// <param name="history">The history</param>
        /// <param name="currConvo">The current conversation</param>
        /// <param name="prevConvos">List of previous conversations</param>
        /// <returns></returns>
        private async Task SerializeAndSaveHistory(ChatHistory? history, ConversationInfo? currConvo, List<ConversationInfo> prevConvos)
        {
            string serializedHistory = JsonSerializer.Serialize(history);
            currConvo.ChatHistory = serializedHistory;

            // Replace storage with recent conversation
            prevConvos.Add(currConvo);

            await _storage.SetAsync("conversations", prevConvos);
        }

        /// <summary>
        /// Retrieves the previous conversations from storage
        /// </summary>
        /// <returns>The list of previous conversations</returns>
        private async Task<List<ConversationInfo>> GetPreviousConvos()
        {

            List<ConversationInfo> prevConvos = await _storage.GetAsync<List<ConversationInfo>>("conversations")
                ?? new List<ConversationInfo>();

            return prevConvos;
        }

        /// <summary>
        /// Calls chat completions where plugins are auto-invoked
        /// </summary>
        /// <param name="context">The turn context</param>
        /// <returns></returns>
        public async Task GetChatMessageContentAsync(IContext<MessageActivity> context)
        {
            List<ConversationInfo> prevConvos = await GetPreviousConvos();
            ConversationInfo? currConvo = prevConvos.Find(x => x.Id == context.Activity.Conversation.Id);
            prevConvos.Remove(currConvo ?? throw new InvalidOperationException("Conversation not found"));

            ChatHistory? history = JsonSerializer.Deserialize<ChatHistory>(currConvo?.ChatHistory ?? string.Empty);
            _kernel.Data["context"] = context.ToActivityType<Activity>();

            if (context.Activity.Conversation.IsGroup != null && context.Activity.Conversation.IsGroup == true)
            {
                await GetChatMessageContentAsyncForNonStreamingGroupScenarios(history, currConvo, prevConvos, context);
            }
            else
            {
                await GetChatMessageContentAsyncForOneToOneScenarios(history, currConvo, prevConvos, context.Stream);
            }
        }

        
        private async Task GetChatMessageContentAsyncForNonStreamingGroupScenarios(ChatHistory? history, ConversationInfo? currConvo,
         List<ConversationInfo> prevConvos, IContext<MessageActivity> context)
        {
            var result = (OpenAIChatMessageContent)await _chatCompletionService.GetChatMessageContentAsync(
                   history ?? new ChatHistory(),
                   executionSettings: _openAIPromptExecutionSettings,
                   kernel: _kernel);

            // Check for tool call
            var latestResult = history?.Last().Items.Last();
            if (latestResult is FunctionResultContent)
            {
                FunctionResultContent function_res = (FunctionResultContent)latestResult;
                if (function_res.PluginName == "GitHubPlugin")
                {
                    // Adaptive card was already sent
                    await SerializeAndSaveHistory(history, currConvo, prevConvos);
                    return;
                }
            }
            else
            {
                history.Add(result);
                await SerializeAndSaveHistory(history, currConvo, prevConvos);

                if (!string.IsNullOrEmpty(result.Content))
                {
                    await context.Send(result.Content);
                }
            }
        }

        private async Task GetChatMessageContentAsyncForOneToOneScenarios(ChatHistory? history, ConversationInfo? currConvo,
        List<ConversationInfo> prevConvos, Microsoft.Teams.Apps.Plugins.IStreamer stream)
        {
            var result = _chatCompletionService.GetStreamingChatMessageContentsAsync(
               history ?? new ChatHistory(),
               executionSettings: _openAIPromptExecutionSettings,
               kernel: _kernel);
            
            var chunkBuilder = new StringBuilder();
            bool hasPluginBeenInvoked = false;

            await foreach (var chunk in result)
            {
                var streamingFunctionCallUpdates = chunk.Items.OfType<StreamingFunctionCallUpdateContent>();

                if (streamingFunctionCallUpdates.Any() && 
                    !string.IsNullOrEmpty(streamingFunctionCallUpdates.First().Name) && 
                    streamingFunctionCallUpdates.First().Name.StartsWith("GitHubPlugin"))
                {
                    hasPluginBeenInvoked = true;
                    continue;
                }
                else if (!hasPluginBeenInvoked)
                {
                    chunkBuilder.Append(chunk.Content);
                }
            }

            // Handle non-plugin scenarios
            if (!hasPluginBeenInvoked && chunkBuilder.Length > 0)
            {
                ChatMessageContent completeMessage = new()
                {
                    Role = AuthorRole.Assistant,
                    Content = ""
                };

                if (chunkBuilder.Length > 0)
                {
                    StringBuilder finalStringBuilder = new StringBuilder(chunkBuilder.ToString());
                    completeMessage.Content += finalStringBuilder.ToString();
                    foreach (var word in finalStringBuilder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries))
                    {
                        await Task.Delay(TimeSpan.FromSeconds(0.01));
                        stream.Emit(word + " ");
                    }
                }

                // Add the complete message to history
                history.Add(completeMessage);
            }

            await SerializeAndSaveHistory(history, currConvo, prevConvos);
        }

    }
}