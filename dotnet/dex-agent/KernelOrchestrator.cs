using System.Text;
using System.Text.Json;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Teams;
using Microsoft.Bot.Schema;
using Microsoft.Bot.Schema.Teams;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Microsoft.Teams.AI.Application;

namespace DexAgent
{
    public class KernelOrchestrator
    {
        private Kernel _kernel;
        private IChatCompletionService _chatCompletionService;
        private OpenAIPromptExecutionSettings _openAIPromptExecutionSettings;
        private IStorage _storage;
        private ConfigOptions _config;

        /// <summary>
        /// Used to manage the chat history and
        /// orchestrate the text-based conversations
        /// </summary>
        /// <param name="kernel">The kernel</param>
        /// <param name="storage">The storage</param>
        /// <param name="config">The configuration pairs</param>
        public KernelOrchestrator(Kernel kernel, IStorage storage, ConfigOptions config)
        {
            _kernel = kernel;
            _chatCompletionService = kernel.GetRequiredService<IChatCompletionService>();
#pragma warning disable SKEXP0010 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
            _openAIPromptExecutionSettings = new()
            {
                ResponseFormat = "json_object",
                FunctionChoiceBehavior = FunctionChoiceBehavior.Auto(),
                Temperature = 0,
            };
#pragma warning restore SKEXP0010 // Type is for evaluation purposes only and is subject to change or removal in future updates. Suppress this diagnostic to proceed.
            _storage = storage;
            _config = config;
        }

        /// <summary>
        /// Creates and adds to the chat history for the current turn
        /// </summary>
        /// <param name="turnContext">The turn context</param>
        /// <returns></returns>
        public async Task CreateChatHistory(ITurnContext turnContext)
        {
            List<ConversationInfo> prevConvos = await GetPreviousConvos();

            // Locate existing conversation, if any
            ConversationInfo currConvo = prevConvos.Find(x => x.Id == turnContext.Activity.Conversation.Id);

            if (currConvo == null)
            {
                currConvo = InitiateChat(turnContext.Activity);
            }
            else
            {
                prevConvos.Remove(currConvo);
            }

            ChatHistory history = JsonSerializer.Deserialize<ChatHistory>(currConvo.ChatHistory);
            history.AddUserMessage(turnContext.Activity.Text);
            await SerializeAndSaveHistory(history, currConvo, prevConvos);
        }

        /// <summary>
        /// Calls chat completions where plugins are auto-invoked
        /// </summary>
        /// <param name="turnContext">The turn context</param>
        /// <returns></returns>
        public async Task GetChatMessageContentAsync(ITurnContext turnContext)
        {
            List<ConversationInfo> prevConvos = await GetPreviousConvos();
            ConversationInfo currConvo = prevConvos.Find(x => x.Id == turnContext.Activity.Conversation.Id);
            ChatHistory history = JsonSerializer.Deserialize<ChatHistory>(currConvo.ChatHistory);
            prevConvos.Remove(currConvo);
            _kernel.Data.Add("context", turnContext);

            if (turnContext.Activity.Conversation.IsGroup != null && turnContext.Activity.Conversation.IsGroup == true)
            {
                await GetChatMessageContentAsyncForNonStreamingGroupScenarios(history, currConvo, prevConvos, turnContext);
            }
            else
            {
                await GetChatMessageContentAsyncForOneToOneScenarios(history, currConvo, prevConvos, turnContext);
            }
        }

        private async Task GetChatMessageContentAsyncForNonStreamingGroupScenarios(ChatHistory history, ConversationInfo currConvo, List<ConversationInfo> prevConvos, ITurnContext turnContext)
        {
            var result = (OpenAIChatMessageContent)await _chatCompletionService.GetChatMessageContentAsync(
                   history,
                   executionSettings: _openAIPromptExecutionSettings,
                   kernel: _kernel);

            // Check for tool call
            var latestResult = history.Last().Items.Last();
            if (latestResult is FunctionResultContent)
            {
                FunctionResultContent function_res = (FunctionResultContent)latestResult;
                if (function_res.FunctionName == "ListPRs")
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

                var resultJson = JsonSerializer.Deserialize<JsonElement>(result.Content);
                // Responses from LLM may vary by key
                string[] resultKeys = new string[] { "message", "response", "capabilities", "features" };
                foreach (var key in resultKeys)
                {
                    string finalStr = "";
                    if (resultJson.TryGetProperty(key, out JsonElement val))
                    {
                        if (key == "capabilities" || key == "features")
                        {
                            foreach (var item in val.EnumerateArray())
                            {
                                var desc = " ";
                                desc += item.GetProperty("description").ToString();
                                finalStr += desc;
                            }
                        }
                        else
                        {
                            finalStr += val.ToString();
                        }
                    }

                    if (!string.IsNullOrEmpty(finalStr))
                    {
                        await turnContext.SendActivityAsync(finalStr);
                    }
                }
            }
        }

        private async Task GetChatMessageContentAsyncForOneToOneScenarios(ChatHistory history, ConversationInfo currConvo, List<ConversationInfo> prevConvos, ITurnContext turnContext)
        {
            var result = _chatCompletionService.GetStreamingChatMessageContentsAsync(
               history,
               executionSettings: _openAIPromptExecutionSettings,
               kernel: _kernel);

            var chunkBuilder = new StringBuilder();

            // Flag is used as plugin info is only returned in second chunk
            bool hasInvokedListPRs = false;

            await foreach (var chunk in result)
            {
                var streamingFunctionCallUpdates = chunk.Items.OfType<StreamingFunctionCallUpdateContent>();
                if (streamingFunctionCallUpdates.Any() && string.Equals(streamingFunctionCallUpdates.First().Name, "GitHubPlugin-ListPRs"))
                {
                    hasInvokedListPRs = true;
                    continue;
                }
                else if (!hasInvokedListPRs)
                {
                    chunkBuilder.Append(chunk.Content);
                }
            }

            // Handle non-plugin scenarios
            if (chunkBuilder.Length > 0)
            {
                ChatMessageContent completeMessage = new()
                {
                    Role = AuthorRole.Assistant,
                    Content = ""
                };
                StreamingResponse streamer = new StreamingResponse(turnContext);
                streamer.EnableGeneratedByAILabel = true;
                streamer.QueueInformativeUpdate("Generating response...");

                // Responses from LLM may vary by key
                var chunkJson = JsonSerializer.Deserialize<JsonElement>(chunkBuilder.ToString());
                string[] resultKeys = new string[] { "message", "response", "capabilities", "features" };
                foreach (var key in resultKeys)
                {
                    if (chunkJson.TryGetProperty(key, out JsonElement val))
                    {
                        if (key == "capabilities" || key == "features")
                        {
                            foreach (var item in val.EnumerateArray())
                            {
                                var desc = " ";
                                desc += item.GetProperty("description").ToString();

                                StringBuilder finalStringBuilder = new StringBuilder(desc);
                                completeMessage.Content += desc;

                                for (var i = 0; i < finalStringBuilder.Length; i++)
                                {
                                    await Task.Delay(TimeSpan.FromSeconds(0.01));
                                    streamer.QueueTextChunk(finalStringBuilder[i].ToString());
                                }
                            }
                        }
                        else
                        {
                            StringBuilder finalStringBuilder = new StringBuilder(val.ToString());
                            completeMessage.Content += val.ToString();

                            for (var i = 0; i < finalStringBuilder.Length; i++)
                            {
                                await Task.Delay(TimeSpan.FromSeconds(0.01));
                                streamer.QueueTextChunk(finalStringBuilder[i].ToString());
                            }
                        }
                    }
                }
                history.Add(completeMessage);
                await streamer.EndStream();
            }

            await SerializeAndSaveHistory(history, currConvo, prevConvos);
        }

        /// <summary>
        /// Saves the activity to the chat history
        /// </summary>
        /// <param name="turnContext">The turn context</param>
        /// <param name="activity">The activity text associated to the turn</param>
        /// <returns></returns>
        public async Task SaveActivityToChatHistory(ITurnContext turnContext, string activity)
        {
            List<ConversationInfo> prevConvos = await GetPreviousConvos();
            ConversationInfo currConvo = prevConvos.Find(x => x.Id == turnContext.Activity.Conversation.Id);
            ChatHistory history = JsonSerializer.Deserialize<ChatHistory>(currConvo.ChatHistory);
            prevConvos.Remove(currConvo);

            ChatMessageContent result = new ChatMessageContent()
            {
                Role = AuthorRole.Assistant,
                Content = activity,
            };

            history.Add(result);
            await SerializeAndSaveHistory(history, currConvo, prevConvos);
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
                    "All responses must be in JSON format. " +
                    "You can list pull requests. " +
                    "You send an adaptive card whenever there is a new assignee on a pull request. " +
                    "You send an adaptive card whenever there is a status update on a pull request. " +
                    "All of the pull requests are in the Teams AI SDK repository. " +
                    "The purpose of GitHub Assistant is to help boost the team's productivity and quality of their engineering lifecycle.");

            string serializedHistory = JsonSerializer.Serialize(chatHistory);

            ConversationInfo convo = new ConversationInfo()
            {
                BotId = _config.BOT_ID,
                Id = activity.Conversation.Id,
                ServiceUrl = activity.ServiceUrl,
                ChatHistory = serializedHistory,
                IsGroup = (activity.Conversation.IsGroup != null) ? (bool)activity.Conversation.IsGroup : false,
            };

            if (string.Equals(activity.Conversation.ConversationType, "channel"))
            {
                TeamInfo teamInfo = activity.TeamsGetTeamInfo();
                var channelData = activity.GetChannelData<TeamsChannelData>();
                convo.TeamId = teamInfo.Id;
                convo.ChannelId = channelData.Channel.Id;
            }

            return convo;
        }

        /// <summary>
        /// Serializes the chat history and saves it to storage
        /// </summary>
        /// <param name="history">The history</param>
        /// <param name="currConvo">The current conversation</param>
        /// <param name="prevConvos">List of previous conversations</param>
        /// <returns></returns>
        private async Task SerializeAndSaveHistory(ChatHistory history, ConversationInfo currConvo, List<ConversationInfo> prevConvos)
        {
            string serializedHistory = JsonSerializer.Serialize(history);
            currConvo.ChatHistory = serializedHistory;

            // Replace storage with recent conversation
            prevConvos.Add(currConvo);
            Dictionary<string, object> updated_entries = new()
            {
                { "conversations", prevConvos }
            };
            await _storage.WriteAsync(updated_entries);
        }

        /// <summary>
        /// Retrieves the previous conversations from storage
        /// </summary>
        /// <returns>The list of previous conversations</returns>
        private async Task<List<ConversationInfo>> GetPreviousConvos()
        {
            IDictionary<string, object> entries = await _storage.ReadAsync(keys: new[] { "conversations" });

            List<ConversationInfo> prevConvos = new List<ConversationInfo>();

            if (entries.ContainsKey("conversations"))
            {
                prevConvos = (List<ConversationInfo>)entries["conversations"];
            }

            return prevConvos;
        }
    }
}
