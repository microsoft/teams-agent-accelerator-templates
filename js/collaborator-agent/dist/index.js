'use strict';

var teams_apps = require('@microsoft/teams.apps');
var teams_dev = require('@microsoft/teams.dev');
var manager$1 = require('./agent/manager');
var message = require('./storage/message');
var config = require('./utils/config');
var debug = require('./utils/debug');
var mockData = require('./utils/mockData');
var utils = require('./utils/utils');
var messageContext = require('./utils/messageContext');

const app = new teams_apps.App({
  plugins: [new teams_dev.DevtoolsPlugin()]
});
const storage = message.getMessageStorage();
const manager = new manager$1.ManagerPrompt(storage);
const mockDataManager = new mockData.MockDataManager(storage);
const feedbackStorage = storage;
app.on("message.submit.feedback", async ({ activity, log }) => {
  try {
    const { reaction, feedback: feedbackJson } = activity.value.actionValue;
    if (activity.replyToId == null) {
      log.warn(`No replyToId found for messageId ${activity.id}`);
      return;
    }
    let existingFeedback = feedbackStorage.getFeedbackByMessageId(activity.replyToId);
    if (!existingFeedback) {
      feedbackStorage.initializeFeedbackRecord(activity.replyToId);
    }
    const success = feedbackStorage.updateFeedback(activity.replyToId, reaction, feedbackJson);
    if (success) {
      console.log(`\u2705 Successfully recorded feedback for message ${activity.replyToId}`);
    } else {
      log.warn(`Failed to record feedback for message ${activity.replyToId}`);
    }
  } catch (error) {
    log.error(`Error processing feedback: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});
app.on("message", async ({ send, activity, next }) => {
  const contextID = await messageContext.createMessageContext(activity);
  const context = messageContext.getContextById(contextID);
  if (!context) {
    console.error("\u274C Failed to retrieve context for activity:", activity.id);
    return;
  }
  try {
    const debugResult = await debug.handleDebugCommand(context.text, context.conversationKey);
    console.log(context.currentDateTime);
    console.log(activity);
    if (debugResult.isDebugCommand) {
      if (debugResult.response) {
        await send({
          type: "message",
          text: debugResult.response
        });
      }
      return;
    }
    if (context.isPersonalChat) {
      await send({ type: "typing" });
      message.addMessageToTracking(context.conversationKey, "user", context.text, activity, context.userName);
      const result = await manager.processRequest(context);
      if (result.response) {
        const sentMessageId = await utils.finalizePromptResponse(send, result.response, result.citations);
        feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
        message.addMessageToTracking(context.conversationKey, "assistant", result.response, { id: sentMessageId }, "AI Assistant");
      } else {
        await send({ type: "message", text: "Hello! I can help you with conversation summaries, action item management, and general assistance. What would you like help with?" });
      }
      await message.saveMessagesDirectly(context.conversationKey);
      return;
    }
    message.addMessageToTracking(context.conversationKey, "user", context.text, activity, context.userName);
    await message.saveMessagesDirectly(context.conversationKey);
    await next();
  } finally {
    messageContext.removeContextById(contextID);
  }
});
app.on("mention", async ({ send, activity, api }) => {
  await send({ type: "typing" });
  const contextID = await messageContext.createMessageContext(activity, api);
  const context = messageContext.getContextById(contextID);
  if (!context) {
    console.error("\u274C Failed to retrieve context for activity:", activity.id);
    return;
  }
  try {
    if (activity.type === "message" && context.text.trim() !== "") {
      const debugResult = await debug.handleDebugCommand(context.text, context.conversationKey);
      if (debugResult.isDebugCommand) {
        if (debugResult.response) {
          await send({ type: "message", text: debugResult.response });
        }
        return;
      }
      const result = await manager.processRequest(context);
      if (result.response) {
        const sentMessageId = await utils.finalizePromptResponse(send, result.response, result.citations);
        feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
        message.addMessageToTracking(context.conversationKey, "assistant", result.response, { id: sentMessageId }, "AI Assistant");
      } else {
        await send({ type: "message", text: "I received your message but I'm not sure how to help with that. I can help with conversation summaries and message analysis." });
      }
      await message.saveMessagesDirectly(context.conversationKey);
    }
  } finally {
    messageContext.removeContextById(contextID);
  }
});
(async () => {
  const port = +(process.env.PORT || 3978);
  try {
    config.validateEnvironment();
    config.logModelConfigs();
    mockDataManager.initializeMockDataIfNeeded();
  } catch (error) {
    console.error("\u274C Configuration error:", error);
    process.exit(1);
  }
  await app.start(port);
  console.log(`\u{1F680} Teams Collaborator Bot started on port ${port}`);
})();
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map