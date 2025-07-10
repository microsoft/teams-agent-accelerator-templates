import { App } from '@microsoft/teams.apps';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { MessageActivity } from '@microsoft/teams.api';
import { promptManager } from './agent/core';
import { validateEnvironment, logModelConfigs } from './utils/config';
import { handleDebugCommand } from './utils/debug';

/**
 * Helper function to send a message with optional adaptive cards
 */
async function sendMessageWithCards(send: any, text: string, adaptiveCards?: any[]): Promise<string> {
  const messageActivity = new MessageActivity(text)
    .addAiGenerated()
    .addFeedback();

  // If we have adaptive cards, add them as attachments
  if (adaptiveCards && adaptiveCards.length > 0) {
    for (const card of adaptiveCards) {
      messageActivity.addAttachments({
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card
      });
    }
  }

  const { id: sentMessageId } = await send(messageActivity);
  return sentMessageId;
}

const app = new App({
  plugins: [new DevtoolsPlugin()],
});

// Initialize feedback storage (reuse the same storage instance from promptManager)
const feedbackStorage = promptManager.getStorage();

app.on('message.submit.feedback', async ({ activity, log }) => {
  try {
    const { reaction, feedback: feedbackJson } = activity.value.actionValue;

    if (activity.replyToId == null) {
      log.warn(`No replyToId found for messageId ${activity.id}`);
      return;
    }

    console.log(`👍 Received feedback for message ${activity.replyToId}: ${reaction}`, feedbackJson);

    let existingFeedback = feedbackStorage.getFeedbackByMessageId(activity.replyToId);
    if (!existingFeedback) {
      feedbackStorage.initializeFeedbackRecord(activity.replyToId);
      console.log(`📝 Initialized feedback record for message ${activity.replyToId} (no prior delegated agent info)`);
    }

    const success = feedbackStorage.updateFeedback(activity.replyToId, reaction, feedbackJson);

    if (success) {
      console.log(`✅ Successfully recorded feedback for message ${activity.replyToId}`);
    } else {
      log.warn(`Failed to record feedback for message ${activity.replyToId}`);
    }

  } catch (error) {
    console.error('❌ Error handling feedback submission:', error);
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
    const userId = activity.from.id;
    const userName = activity.from.name || 'User';

   const userTimezone = (activity as any).localTimezone;
    promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);

    const result = await promptManager.processUserRequestWithPersonalMode(
      conversationKey,
      activity.text,
      null,
      userId,
      userName,
      userTimezone
    );

    if (result.response && result.response.trim() !== '') {
      const sentMessageId = await sendMessageWithCards(send, result.response, result.adaptiveCards);

      feedbackStorage.storeDelegatedAgent(sentMessageId, result.delegatedAgent);

     
      promptManager.addMessageToTracking(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
    } else {
      await send({ type: 'message', text: 'Hello! I can help you with conversation summaries, action item management, and general assistance. What would you like help with?' });
    }

    await promptManager.saveMessagesDirectly(conversationKey);
    console.log('💾 Personal chat messages saved to database');

    return;
  }

  const userName = activity.from.name || 'user';
  promptManager.addMessageToTracking(conversationKey, 'user', activity.text, activity, userName);

  await promptManager.saveMessagesDirectly(conversationKey);
  console.log('💾 Messages saved to database');

  await next();
});

app.on('mention', async ({ send, activity, api }) => {
  const conversationKey = `${activity.conversation.id}`;
  console.log('🔍 Bot @mentioned - processing query with manager agent');

  const members = await api.conversations.members(conversationKey).get();
  console.log(members);

  if (activity.type === 'message' && activity.text && activity.text.trim() !== '') {
    const debugResult = await handleDebugCommand(activity.text, conversationKey);
    if (debugResult.isDebugCommand) {
      if (debugResult.response) {
        await send({ type: 'message', text: debugResult.response });
        console.log('🛠️ Debug command executed via @mention:', activity.text.trim());
      }
      return;
    }

    const userTimezone = (activity as any).localTimezone;
    if (userTimezone) {
      console.log(`🕒 Detected user timezone: ${userTimezone}`);
    }

    const result = await promptManager.processUserRequest(conversationKey, activity.text, api, userTimezone);

    if (result.response && result.response.trim() !== '') {
      const sentMessageId = await sendMessageWithCards(send, result.response, result.adaptiveCards);

      feedbackStorage.storeDelegatedAgent(sentMessageId, result.delegatedAgent);

      promptManager.addMessageToTracking(conversationKey, 'assistant', result.response, { id: sentMessageId }, 'AI Assistant');
    } else {
      await send({ type: 'message', text: 'I received your message but I\'m not sure how to help with that. I can help with conversation summaries and message analysis.' });
    }
    await promptManager.saveMessagesDirectly(conversationKey);
  }
});

(async () => {
  const port = +(process.env.PORT || 3978);
  try {
    validateEnvironment();
    logModelConfigs();
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exit(1);
  }

  await app.start(port);

  console.log(`🚀 Teams Collaborator Bot started on port ${port}`);
})();
