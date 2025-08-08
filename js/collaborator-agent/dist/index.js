'use strict';

var teams_apps = require('@microsoft/teams.apps');
var teams_dev = require('@microsoft/teams.dev');
var manager = require('./agent/manager');
var config = require('./utils/config');
var utils = require('./utils/utils');
var messageContext = require('./utils/messageContext');
var storage$1 = require('./storage/storage');
var teams_common = require('@microsoft/teams.common');

const logger = new teams_common.ConsoleLogger("collaborator", { level: "debug" });
const app = new teams_apps.App({
  plugins: [new teams_dev.DevtoolsPlugin()],
  logger
});
const storage = new storage$1.SqliteKVStore();
const feedbackStorage = storage;
app.on("message.submit.feedback", async ({ activity, log }) => {
  try {
    const { reaction, feedback: feedbackJson } = activity.value.actionValue;
    if (activity.replyToId == null) {
      logger.warn(`No replyToId found for messageId ${activity.id}`);
      return;
    }
    let existingFeedback = feedbackStorage.getFeedbackByMessageId(activity.replyToId);
    if (!existingFeedback) {
      feedbackStorage.initializeFeedbackRecord(activity.replyToId);
    }
    const success = feedbackStorage.updateFeedback(activity.replyToId, reaction, feedbackJson);
    if (success) {
      logger.debug(`\u2705 Successfully recorded feedback for message ${activity.replyToId}`);
    } else {
      logger.warn(`Failed to record feedback for message ${activity.replyToId}`);
    }
  } catch (error) {
    logger.error(`Error processing feedback: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
});
app.on("message", async ({ send, activity, api, log }) => {
  const botMentioned = activity.entities?.some((e) => e.type === "mention");
  const context = botMentioned ? await messageContext.createMessageContext(storage, activity, api) : await messageContext.createMessageContext(storage, activity);
  let trackedMessages;
  if (!activity.conversation.isGroup || botMentioned) {
    await send({ type: "typing" });
    const manager$1 = new manager.ManagerPrompt(context, logger.child("Manager"));
    const result = await manager$1.processRequest();
    const formattedResult = utils.finalizePromptResponse(result.response, context);
    const sent = await send(formattedResult);
    formattedResult.id = sent.id;
    trackedMessages = utils.createMessageRecords([activity, formattedResult]);
  } else {
    trackedMessages = utils.createMessageRecords([activity]);
  }
  log.debug(trackedMessages);
  context.memory.addMessages(trackedMessages);
});
(async () => {
  const port = +(process.env.PORT || 3978);
  try {
    config.validateEnvironment(logger);
    config.logModelConfigs(logger);
  } catch (error) {
    console.error("\u274C Configuration error:", error);
    process.exit(1);
  }
  await app.start(port);
  console.log(`\u{1F680} Teams Collaborator Bot started on port ${port}`);
})();
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map