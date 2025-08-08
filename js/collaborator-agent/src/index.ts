import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { ManagerPrompt } from './agent/manager';
import { validateEnvironment, logModelConfigs } from './utils/config';
import { finalizePromptResponse, createMessageRecords } from './utils/utils';
import { createMessageContext } from './utils/messageContext';
import { SqliteKVStore } from './storage/storage';
import { ConsoleLogger } from '@microsoft/teams.common';

const logger = new ConsoleLogger('collaborator', { level: 'debug' });

const app = new App({
  plugins: [new DevtoolsPlugin()],
  logger
});

// Initialize storage
const storage = new SqliteKVStore();

// Initialize feedback storage
const feedbackStorage = storage;

app.on('message.submit.feedback', async ({ activity, log }) => {
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
      logger.debug(`✅ Successfully recorded feedback for message ${activity.replyToId}`);
    } else {
      logger.warn(`Failed to record feedback for message ${activity.replyToId}`);
    }

  } catch (error) {
    logger.error(`Error processing feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

app.on('message', async ({ send, activity, api, log }) => {
  
  const botMentioned = activity.entities?.some((e) => e.type === 'mention');
  const context = botMentioned ? await createMessageContext(storage, activity, api) : await createMessageContext(storage, activity);

  let trackedMessages;

  if (!activity.conversation.isGroup || botMentioned) { // process request if One-on-One chat or if @mentioned in Groupchat
    await send({ type: 'typing' });

    const manager = new ManagerPrompt(context, logger.child('Manager'));
    const result = await manager.processRequest();
    const formattedResult = finalizePromptResponse(result.response, context);

    const sent = await send(formattedResult);
    formattedResult.id = sent.id;

    trackedMessages = createMessageRecords([activity, formattedResult]);
  } else {
    trackedMessages = createMessageRecords([activity]);
  }

  log.debug(trackedMessages);
  context.memory.addMessages(trackedMessages);
});

(async ( ) => {
  const port = +(process.env.PORT || 3978);
  try {
    validateEnvironment(logger);
    logModelConfigs(logger);
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exit(1);
  }

  await app.start(port);

  console.log(`🚀 Teams Collaborator Bot started on port ${port}`);
})();
