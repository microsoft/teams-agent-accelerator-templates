import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore, MessageRecord } from '../storage/storage';
import { getModelConfig } from '../utils/config';
import { IMessageActivity } from '@microsoft/teams.api';
import { SEARCH_PROMPT } from '../agent/instructions';

// Function schemas for search operations
const SEARCH_MESSAGES_SCHEMA = {
  type: 'object' as const,
  properties: {
    keywords: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Keywords to search for in message content (excluding time expressions)'
    },
    participants: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Names of people who should be involved in the conversation'
    },
    start_time: {
      type: 'string' as const,
      description: 'Start time for search range (ISO format). Calculate this based on user request like "earlier today", "yesterday", etc.'
    },
    end_time: {
      type: 'string' as const,
      description: 'End time for search range (ISO format). Usually current time for "earlier today" or end of day for specific dates.'
    },
    max_results: {
      type: 'number' as const,
      description: 'Maximum number of results to return (default 10)',
      default: 10
    }
  },
  required: ['keywords']
};

/**
 * Create an Adaptive Card with deep link to original message
 */
export function createQuotedAdaptiveCard(activity: IMessageActivity): any {
  if (!activity.id || !activity.conversation?.id) {
    throw new Error("Missing activity.id or conversation.id");
  }

  const messageText = activity.text ?? "<no message text>";
  const senderName = activity.from?.name ?? "Unknown";
  const timestamp = activity.timestamp
    ? new Date(activity.timestamp).toLocaleString()
    : "";

  // Build deep link with chat context
  const chatId = activity.conversation.id;
  const messageId = activity.id;
  const contextParam = encodeURIComponent(JSON.stringify({ contextType: "chat" }));
  const deepLink = `https://teams.microsoft.com/l/message/${encodeURIComponent(chatId)}/${messageId}?context=${contextParam}`;

  // Return Adaptive Card JSON
  return {
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: `"${messageText}"`,
        wrap: true,
        weight: "Bolder",
        color: "Accent",
        spacing: "Medium"
      },
      {
        type: "TextBlock",
        text: `— ${senderName}${timestamp ? `, ${timestamp}` : ""}`,
        isSubtle: true,
        wrap: true,
        spacing: "None"
      }
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View Original Message",
        url: deepLink
      }
    ],
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
  };
}

/**
 * Create an Adaptive Card from a stored message record
 */
export function createQuotedAdaptiveCardFromRecord(message: MessageRecord, conversationId: string): any {
  if (!message.activity_id) {
    throw new Error("Message record missing activity_id for deep linking");
  }

  const messageText = message.content ?? "<no message text>";
  const senderName = message.name ?? "Unknown";
  const timestamp = message.timestamp
    ? new Date(message.timestamp).toLocaleString()
    : "";

  // Build deep link with chat context
  const chatId = conversationId;
  const messageId = message.activity_id;
  const contextParam = encodeURIComponent(JSON.stringify({ contextType: "chat" }));
  const deepLink = `https://teams.microsoft.com/l/message/${encodeURIComponent(chatId)}/${messageId}?context=${contextParam}`;

  // Return Adaptive Card JSON
  return {
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: `"${messageText}"`,
        wrap: true,
        weight: "Bolder",
        color: "Accent",
        spacing: "Medium"
      },
      {
        type: "TextBlock",
        text: `— ${senderName}${timestamp ? `, ${timestamp}` : ""}`,
        isSubtle: true,
        wrap: true,
        spacing: "None"
      }
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "View Original Message",
        url: deepLink
      }
    ],
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json"
  };
}

/**
 * Search for messages based on keywords and participants
 */
function searchMessages(
  storage: SqliteKVStore,
  conversationId: string,
  keywords: string[],
  participants: string[] = [],
  startTime?: string,
  endTime?: string,
  maxResults: number = 10
): MessageRecord[] {
  try {
    // Get messages in the time range
    const messages = storage.getMessagesByTimeRange(conversationId, startTime, endTime);
    
    // Filter by keywords (case-insensitive)
    let filteredMessages = messages.filter(msg => {
      const content = msg.content.toLowerCase();
      return keywords.some(keyword => content.includes(keyword.toLowerCase()));
    });
    
    // Filter by participants if specified
    if (participants.length > 0) {
      filteredMessages = filteredMessages.filter(msg => {
        const name = msg.name.toLowerCase();
        return participants.some(participant => 
          name.includes(participant.toLowerCase()) || 
          participant.toLowerCase().includes(name)
        );
      });
    }
    
    // Sort by timestamp (most recent first) and limit results
    filteredMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return filteredMessages.slice(0, maxResults);
    
  } catch (error) {
    console.error(`❌ Error searching messages:`, error);
    return [];
  }
}

/**
 * Create the search prompt for a specific conversation
 */
export function createSearchPrompt(
  conversationId: string,
  storage: SqliteKVStore,
  userTimezone?: string,
  adaptiveCardsArray?: any[]
): ChatPrompt {
  const searchModelConfig = getModelConfig('search');
  
  // Get current date and timezone info for the LLM
  const currentDate = new Date().toISOString();
  const timezone = userTimezone || 'UTC';
  
  const prompt = new ChatPrompt({
    instructions: `${SEARCH_PROMPT}

CURRENT CONTEXT:
- Current date/time: ${currentDate}
- User timezone: ${timezone}
- When calculating time ranges like "earlier today", "yesterday", use the current time and timezone above
- Always provide start_time and end_time in ISO format when searching for time-based queries`,
    model: new OpenAIChatModel({
      model: searchModelConfig.model,
      apiKey: searchModelConfig.apiKey,
      endpoint: searchModelConfig.endpoint,
      apiVersion: searchModelConfig.apiVersion,
    }),
  })
  .function('search_messages', 'Search for messages in the conversation history', SEARCH_MESSAGES_SCHEMA, async (args: any) => {
    const { keywords, participants = [], start_time, end_time, max_results = 10 } = args;
    
    // Search for matching messages
    const matchingMessages = searchMessages(
      storage,
      conversationId,
      keywords,
      participants,
      start_time,
      end_time,
      max_results
    );
    
    if (matchingMessages.length === 0) {
      return 'No messages found matching your search criteria. Try different keywords or a broader time range.';
    }
    
    // Group messages by time periods for better context
    const groupedMessages = groupMessagesByTime(matchingMessages);
    
    // Create a summary response
    let response = `Found ${matchingMessages.length} messages matching your search:\n\n`;
    
    groupedMessages.forEach(group => {
      response += `**${group.period}** (${group.messages.length} messages)\n`;
      group.messages.slice(0, 3).forEach(msg => {
        const preview = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
        response += `• ${msg.name}: "${preview}"\n`;
      });
      if (group.messages.length > 3) {
        response += `  ... and ${group.messages.length - 3} more\n`;
      }
      response += '\n';
    });

    // Create adaptive cards for the first few results (limit to 5 to avoid overwhelming the user)
    const cardsToShow = matchingMessages.slice(0, 5);
    const adaptiveCards = cardsToShow.map(msg => createQuotedAdaptiveCardFromRecord(msg, conversationId));
    
    // If we have an array to store cards, add them there for the manager to access
    if (adaptiveCardsArray) {
      adaptiveCardsArray.push(...adaptiveCards);
    }
    
    // Return just the summary text (adaptive cards are handled via the shared array)
    return response;
  });
  
  return prompt;
}

/**
 * Group messages by time periods for better organization
 */
function groupMessagesByTime(messages: MessageRecord[]): Array<{ period: string, messages: MessageRecord[] }> {
  const groups: { [key: string]: MessageRecord[] } = {};
  const now = new Date();
  
  messages.forEach(msg => {
    const msgDate = new Date(msg.timestamp);
    const diffHours = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60);
    
    let period: string;
    if (diffHours < 24) {
      period = 'Today';
    } else if (diffHours < 48) {
      period = 'Yesterday';
    } else if (diffHours < 168) { // 7 days
      period = 'This week';
    } else if (diffHours < 720) { // 30 days
      period = 'This month';
    } else {
      period = 'Older';
    }
    
    if (!groups[period]) {
      groups[period] = [];
    }
    groups[period].push(msg);
  });
  
  // Return in chronological order (most recent first)
  const orderedPeriods = ['Today', 'Yesterday', 'This week', 'This month', 'Older'];
  return orderedPeriods
    .filter(period => groups[period])
    .map(period => ({ period, messages: groups[period] }));
}
