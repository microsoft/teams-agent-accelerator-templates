import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { ManagerPrompt } from './agent/manager';
import { addMessageToTracking, saveMessagesDirectly, getMessageStorage } from './storage/message';
import { validateEnvironment, logModelConfigs } from './utils/config';
import { handleDebugCommand } from './utils/debug';
import { MockDataManager } from './utils/mockData';
import { finalizePromptResponse } from './utils/utils';
import { createMessageContext, getContextById, removeContextById } from './utils/messageContext';

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

// Initialize storage and manager (reuse the singleton from message.ts)
const storage = getMessageStorage();
const manager = new ManagerPrompt(storage);
const mockDataManager = new MockDataManager(storage);

// Initialize feedback storage
const feedbackStorage = storage;

app.on('message.submit.feedback', async ({ activity, log }) => {
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
      console.log(`✅ Successfully recorded feedback for message ${activity.replyToId}`);
    } else {
      log.warn(`Failed to record feedback for message ${activity.replyToId}`);
    }

  } catch (error) {
    log.error(`Error processing feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

app.on('message', async ({ send, activity, next }) => {
  const contextID = await createMessageContext(activity);
  const context = getContextById(contextID);
  
  if (!context) {
    console.error('❌ Failed to retrieve context for activity:', activity.id);
    return;
  }

  try {
    const debugResult = await handleDebugCommand(context.text, context.conversationKey);

    console.log(context.currentDateTime);
    console.log(activity);
    if (debugResult.isDebugCommand) {
      if (debugResult.response) {
        await send({
          type: 'message',
          text: debugResult.response
        });
      }
      return;
    }

    // If this is a personal chat, always route to the manager for full conversational experience
    if (context.isPersonalChat) {
      await send({ type: 'typing' });

      addMessageToTracking(context.conversationKey, 'user', context.text, activity, context.userName);

      const result = await manager.processRequest(context);

      if (result.response) {
        const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);
        feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
        addMessageToTracking(context.conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
      } else {
        await send({ type: 'message', text: 'Hello! I can help you with conversation summaries, action item management, and general assistance. What would you like help with?' });
      }
      await saveMessagesDirectly(context.conversationKey);
      return;
    }

    addMessageToTracking(context.conversationKey, 'user', context.text, activity, context.userName);

    await saveMessagesDirectly(context.conversationKey);

    await next();
  } finally {
    // Clean up context after processing
    removeContextById(contextID);
  }
});

app.on('mention', async ({ send, activity, api }) => {
  await send({ type: 'typing' });
  const contextID = await createMessageContext(activity, api);
  const context = getContextById(contextID);
  
  if (!context) {
    console.error('❌ Failed to retrieve context for activity:', activity.id);
    return;
  }

  try {
    if (activity.type === 'message' && context.text.trim() !== '') {
      const debugResult = await handleDebugCommand(context.text, context.conversationKey);
      if (debugResult.isDebugCommand) {
        if (debugResult.response) {
          await send({ type: 'message', text: debugResult.response });
        }
        return;
      }

      const result = await manager.processRequest(context);

      if (result.response) {
        const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);

        feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);

        addMessageToTracking(context.conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
      } else {
        await send({ type: 'message', text: 'I received your message but I\'m not sure how to help with that. I can help with conversation summaries and message analysis.' });
      }
      await saveMessagesDirectly(context.conversationKey);
    }
  } finally {
    // Clean up context after processing
    removeContextById(contextID);
  }
});

(async () => {
  const port = +(process.env.PORT || 3978);
  try {
    validateEnvironment();
    logModelConfigs();

    // Initialize mock data if needed
    mockDataManager.initializeMockDataIfNeeded();
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exit(1);
  }

  await app.start(port);

  console.log(`🚀 Teams Collaborator Bot started on port ${port}`);
})();
