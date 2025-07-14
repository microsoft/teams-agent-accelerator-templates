import { getMessagesWithTimestamps, getMessageStorage, clearConversation } from '../storage/message';

// Interface for debug command response
interface DebugResponse {
  isDebugCommand: boolean;
  response?: string;
}

/**
 * Centralized debug command handler
 * Processes debug commands and returns appropriate responses
 */
export async function handleDebugCommand(text: string, conversationKey: string): Promise<DebugResponse> {
  const trimmedText = text?.trim();
  
  if (!trimmedText) {
    return { isDebugCommand: false };
  }

  switch (trimmedText) {
    case 'msg.db':
      return handleMessageDatabaseDebug(conversationKey);
    
    case 'clear.convo':
      return handleClearConversation(conversationKey);
    
    case 'action.items':
      return handleActionItemsDebug(conversationKey);
    
    case 'clear.actions':
      return handleClearActionItems(conversationKey);
    
    case 'help.debug':
      return handleDebugHelp();
    
    case 'personal.actions':
      return handlePersonalActionItemsDebug(conversationKey);
    
    case 'feedback.stats':
      return handleFeedbackStats();
    
    case 'feedback.clear':
      return handleClearFeedback();
    
    default:
      return { isDebugCommand: false };
  }
}

/**
 * Show database debug information
 */
function handleMessageDatabaseDebug(conversationKey: string): DebugResponse {
  const storage = getMessageStorage();
  const debugOutput = storage.debugPrintDatabase(conversationKey);
  
  // Get message records to show activity ID statistics
  const messages = getMessagesWithTimestamps(conversationKey);
  const messagesWithIds = messages.filter(msg => msg.activity_id && msg.activity_id !== null);
  
  let response = `🔍 **Database Debug Info:**\n\n`;
  response += `📊 **Activity ID Statistics:**\n`;
  response += `- Total messages: ${messages.length}\n`;
  response += `- Messages with IDs: ${messagesWithIds.length}\n`;
  response += `- Coverage: ${messages.length > 0 ? Math.round((messagesWithIds.length / messages.length) * 100) : 0}%\n\n`;
  
  if (messagesWithIds.length > 0) {
    response += `� **Recent Messages with Activity IDs:**\n`;
    messagesWithIds.slice(-5).forEach(msg => {
      const preview = msg.content.substring(0, 30) + (msg.content.length > 30 ? '...' : '');
      response += `- ${msg.name} (${msg.role}): "${preview}" [ID: ${msg.activity_id}]\n`;
    });
    response += `\n`;
  }
  
  response += `📋 **Full Database Details:**\n\`\`\`json\n${debugOutput}\n\`\`\``;
  
  return {
    isDebugCommand: true,
    response
  };
}

/**
 * Clear conversation history
 */
function handleClearConversation(conversationKey: string): DebugResponse {
  clearConversation(conversationKey);
  
  return {
    isDebugCommand: true,
    response: `🧹 **Conversation Cleared!**\n\nAll conversation history for this chat has been cleared from the database.\n\n💡 This includes:\n- Message history\n- Timestamps\n- Context data\n\nYou can start fresh now!`
  };
}

/**
 * Show action items debug information
 */
function handleActionItemsDebug(conversationKey: string): DebugResponse {
  const storage = getMessageStorage();
  const actionItems = storage.getActionItemsByConversation(conversationKey);
  const summary = storage.getActionItemsSummary();
  
  let response = `📋 **Action Items Debug Info:**\n\n`;
  
  if (actionItems.length > 0) {
    response += `**Action Items for this conversation (${actionItems.length}):**\n`;
    actionItems.forEach(item => {
      const statusEmoji = item.status === 'completed' ? '✅' : 
                         item.status === 'in_progress' ? '🔄' : 
                         item.status === 'cancelled' ? '❌' : '⏳';
      const priorityEmoji = item.priority === 'urgent' ? '🔥' : 
                           item.priority === 'high' ? '⚡' : 
                           item.priority === 'medium' ? '📍' : '🔹';
      
      response += `\n${statusEmoji} **#${item.id}** ${priorityEmoji} ${item.title}\n`;
      response += `   👤 Assigned to: ${item.assigned_to}\n`;
      response += `   📝 ${item.description}\n`;
      response += `   📅 Created: ${new Date(item.created_at).toLocaleDateString()}\n`;
      if (item.due_date) {
        response += `   ⏰ Due: ${new Date(item.due_date).toLocaleDateString()}\n`;
      }
    });
  } else {
    response += `**No action items found for this conversation.**\n`;
  }
  
  response += `\n**Overall Summary:**\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``;
  
  return {
    isDebugCommand: true,
    response
  };
}

/**
 * Clear all action items for the conversation
 */
function handleClearActionItems(conversationKey: string): DebugResponse {
  const storage = getMessageStorage();
  const clearedCount = storage.clearActionItems(conversationKey);
  
  return {
    isDebugCommand: true,
    response: `🧹 **Action Items Cleared!**\n\n${clearedCount} action items have been removed from this conversation.\n\n💡 This includes:\n- All pending tasks\n- Completed action items\n- Assignment history\n\nAction item tracking has been reset for this chat.`
  };
}

/**
 * Show debug help with all available commands
 */
function handleDebugHelp(): DebugResponse {
  const helpText = `🛠️ **Debug Commands Help**\n\n**Available Commands:**\n\n` +
    `📊 **\`msg.db\`** - Show database and message history debug info\n` +
    `🧹 **\`clear.convo\`** - Clear conversation messages and history\n` +
    `📋 **\`action.items\`** - Show action items debug info\n` +
    `🗑️ **\`clear.actions\`** - Clear all action items for this conversation\n` +
    `👤 **\`personal.actions\`** - Show personal action items debug info\n` +
    `� **\`feedback.stats\`** - Show AI response feedback statistics\n` +
    `🧹 **\`feedback.clear\`** - Clear all feedback records\n` +
    `❓ **\`help.debug\`** - Show this help message\n\n` +
    `**Usage:** Simply type any command in the chat to execute it.\n\n` +
    `💡 **Note:** Debug commands work in any conversation and only affect the current chat.`;

  return {
    isDebugCommand: true,
    response: helpText
  };
}

/**
 * Get list of all available debug commands
 */
export function getDebugCommands(): string[] {
  return [
    'msg.db',
    'clear.convo', 
    'action.items',
    'clear.actions',
    'help.debug',
    'personal.actions',
    'feedback.stats',
    'feedback.clear'
  ];
}

/**
 * Check if a text string is a debug command
 */
export function isDebugCommand(text: string): boolean {
  const trimmedText = text?.trim();
  return getDebugCommands().includes(trimmedText);
}

/**
 * Show personal action items debug information for a specific user
 */
function handlePersonalActionItemsDebug(_conversationKey: string): DebugResponse {
  const storage = getMessageStorage();
  
  // Get all action items across all conversations to show user IDs
  const allActionItems = storage.getAllActionItems();
  
  let response = `👤 **Personal Action Items Debug:**\n\n`;
  
  if (allActionItems.length > 0) {
    response += `**All Action Items Across All Conversations (${allActionItems.length}):**\n`;
    allActionItems.forEach(item => {
      const statusEmoji = item.status === 'completed' ? '✅' : 
                         item.status === 'in_progress' ? '🔄' : 
                         item.status === 'cancelled' ? '❌' : '⏳';
      const priorityEmoji = item.priority === 'urgent' ? '🔥' : 
                           item.priority === 'high' ? '⚡' : 
                           item.priority === 'medium' ? '📍' : '🔹';
      
      response += `\n${statusEmoji} **#${item.id}** ${priorityEmoji} ${item.title}\n`;
      response += `   👤 Assigned to: ${item.assigned_to}\n`;
      response += `   🆔 User ID: ${item.assigned_to_id || 'N/A'}\n`;
      response += `   📝 ${item.description}\n`;
      response += `   📅 Created: ${new Date(item.created_at).toLocaleDateString()}\n`;
      response += `   💬 Conversation: ${item.conversation_id}\n`;
      if (item.due_date) {
        response += `   ⏰ Due: ${new Date(item.due_date).toLocaleDateString()}\n`;
      }
    });
    
    // Show breakdown by user ID
    response += `\n**Breakdown by User ID:**\n`;
    const userGroups = allActionItems.reduce((groups, item) => {
      const userId = item.assigned_to_id || 'NO_ID';
      if (!groups[userId]) groups[userId] = [];
      groups[userId].push(item);
      return groups;
    }, {} as Record<string, typeof allActionItems>);
    
    Object.entries(userGroups).forEach(([userId, items]) => {
      response += `- **${userId}**: ${items.length} action items (${items[0]?.assigned_to || 'Unknown'})\n`;
    });
  } else {
    response += `**No action items found across all conversations.**\n`;
  }
  
  return {
    isDebugCommand: true,
    response
  };
}

/**
 * Show feedback statistics
 */
function handleFeedbackStats(): DebugResponse {
  const storage = getMessageStorage();
  const summary = storage.getFeedbackSummary();
  const allFeedback = storage.getAllFeedback();
  
  let response = `**🔄 Feedback Statistics**\n\n`;
  response += `**Summary:**\n`;
  response += `- Total feedback records: ${summary.total_feedback_records}\n`;
  response += `- Total likes: ${summary.total_likes}\n`;
  response += `- Total dislikes: ${summary.total_dislikes}\n`;
  response += `- Like ratio: ${summary.like_ratio}\n\n`;
  
  if (allFeedback.length > 0) {
    response += `**Recent Feedback (last 5):**\n`;
    allFeedback.slice(0, 5).forEach((feedback, index) => {
      const feedbacks = JSON.parse(feedback.feedbacks || '[]');
      const feedbackTexts = feedbacks.map((f: any) => f.feedbackText || 'N/A').join(', ');
      response += `${index + 1}. Message: ${feedback.message_id.substring(0, 8)}...\n`;
      response += `   👍 ${feedback.likes} | 👎 ${feedback.dislikes}\n`;
      if (feedbackTexts) {
        response += `   Comments: "${feedbackTexts}"\n`;
      }
      response += `   Created: ${new Date(feedback.created_at).toLocaleDateString()}\n\n`;
    });
  } else {
    response += `**No feedback records found.**\n`;
  }
  
  return {
    isDebugCommand: true,
    response
  };
}

/**
 * Clear all feedback records
 */
function handleClearFeedback(): DebugResponse {
  const storage = getMessageStorage();
  const deletedCount = storage.clearAllFeedback();
  
  const response = `**🧹 Feedback Database Cleared**\n\nDeleted ${deletedCount} feedback records.`;
  
  return {
    isDebugCommand: true,
    response
  };
}
