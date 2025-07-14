import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { MessageActivity, CitationAppearance } from '@microsoft/teams.api';
import { ManagerPrompt } from './agent/manager';
import { addMessageToTracking, saveMessagesDirectly, getMessageStorage } from './storage/message';
import { validateEnvironment, logModelConfigs } from './utils/config';
import { handleDebugCommand } from './utils/debug';
import { MockDataManager } from './utils/mockData';

/**
 * Helper function to finalize and send a prompt response with citations
 */
async function finalizePromptResponse(send: any, text: string, citations?: CitationAppearance[]): Promise<string> {
  const messageActivity = new MessageActivity(text)
    .addAiGenerated()
    .addFeedback();

  // Add citations if provided
  if (citations && citations.length > 0) {
    console.log(`Adding ${citations.length} citations to message activity`);
    citations.forEach((citation, index) => {
      const citationNumber = index + 1;
      messageActivity.addCitation(citationNumber, citation);
      // The corresponding citation needs to be added in the message content
      messageActivity.text += ` [${citationNumber}]`;
    });
  }

  console.log('Citations in message activity:');
  console.log(JSON.stringify(messageActivity.entities?.find(e => e.citation)?.citation, null, 2));
  const { id: sentMessageId } = await send(messageActivity);
  return sentMessageId;
}

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
  const conversationKey = `${activity.conversation.id}`;
  const isPersonalChat = activity.conversation.conversationType === 'personal';

  const debugResult = await handleDebugCommand(activity.text || '', conversationKey);

  console.log(new Date().toISOString().split('T')[0]);
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
  if (isPersonalChat && activity.text && activity.text.trim() !== '') {
    await send({ type: 'typing' });
    const userId = activity.from.id;
    const userName = activity.from.name || 'User';

   const userTimezone = (activity as any).localTimezone;
    addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);

    const result = await manager.processRequestWithPersonalMode(
      activity.text,
      conversationKey,
      null,
      userId,
      userName,
      userTimezone
    );

    if (result.response && result.response.trim() !== '') {
      const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);
      feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);
      addMessageToTracking(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
    } else {
      await send({ type: 'message', text: 'Hello! I can help you with conversation summaries, action item management, and general assistance. What would you like help with?' });
    }
    await saveMessagesDirectly(conversationKey);
    return;
  }

  const userName = activity.from.name || 'user';
  addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);

  await saveMessagesDirectly(conversationKey);

  await next();
});

app.on('mention', async ({ send, activity, api }) => {
  await send({ type: 'typing' });
  const conversationKey = `${activity.conversation.id}`;

  if (activity.type === 'message' && activity.text && activity.text.trim() !== '') {
    const debugResult = await handleDebugCommand(activity.text, conversationKey);
    if (debugResult.isDebugCommand) {
      if (debugResult.response) {
        await send({ type: 'message', text: debugResult.response });
      }
      return;
    }

    const userTimezone = (activity as any).localTimezone;

    const result = await manager.processRequestWithAPI(activity.text, conversationKey, api, userTimezone);

    if (result.response && result.response.trim() !== '') {
      const sentMessageId = await finalizePromptResponse(send, result.response, result.citations);

      feedbackStorage.storeDelegatedCapability(sentMessageId, result.delegatedCapability);

      addMessageToTracking(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
    } else {
      await send({ type: 'message', text: 'I received your message but I\'m not sure how to help with that. I can help with conversation summaries and message analysis.' });
    }
    await saveMessagesDirectly(conversationKey);
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
