import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore, MessageRecord } from '../storage/storage';
import { getModelConfig } from '../utils/config';
import { IMessageActivity } from '@microsoft/teams.api';

// Search prompt instructions
const SEARCH_PROMPT = `You are a conversation search assistant. Your role is to help users find specific conversations or messages from their chat history.

You can search through message history to find:
- Conversations between specific people
- Messages about specific topics
- Messages from specific time periods
- Messages containing specific keywords

When a user asks you to find something, use the search_messages function to search the database and return relevant results with deep links to the original messages.

When you find matching messages, present them in a helpful format:
1. Start with a brief summary of what was found
2. Present the results with clear context about when they occurred and who was involved
3. If adaptive cards are available, mention that users can click "View Original Message" to see the full conversation
4. If no results are found, suggest alternative search terms or broader criteria

Be helpful and conversational in your responses. Focus on helping users find the specific information they're looking for.`;

// Function schemas for search operations
const SEARCH_MESSAGES_SCHEMA = {
  type: 'object' as const,
  properties: {
    keywords: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Keywords to search for in message content'
    },
    participants: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Names of people who should be involved in the conversation'
    },
    start_time: {
      type: 'string' as const,
      description: 'Start time for search range (ISO format, optional)'
    },
    end_time: {
      type: 'string' as const,
      description: 'End time for search range (ISO format, optional)'
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
    console.log(`🔍 Searching messages with keywords: [${keywords.join(', ')}], participants: [${participants.join(', ')}]`);
    
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
    
    console.log(`🔍 Found ${filteredMessages.length} matching messages, returning top ${Math.min(maxResults, filteredMessages.length)}`);
    return filteredMessages.slice(0, maxResults);
    
  } catch (error) {
    console.error(`❌ Error searching messages:`, error);
    return [];
  }
}

/**
 * Parse relative time expressions like "earlier today", "yesterday", "this week"
 */
function parseRelativeTime(timeExpression: string): { startTime?: string, endTime?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  timeExpression = timeExpression.toLowerCase();
  
  if (timeExpression.includes('today') || timeExpression.includes('earlier today')) {
    return {
      startTime: today.toISOString(),
      endTime: now.toISOString()
    };
  }
  
  if (timeExpression.includes('yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    return {
      startTime: yesterday.toISOString(),
      endTime: endOfYesterday.toISOString()
    };
  }
  
  if (timeExpression.includes('this week')) {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    return {
      startTime: startOfWeek.toISOString(),
      endTime: now.toISOString()
    };
  }
  
  if (timeExpression.includes('last week')) {
    const startOfLastWeek = new Date(today);
    startOfLastWeek.setDate(today.getDate() - today.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
    endOfLastWeek.setHours(23, 59, 59, 999);
    return {
      startTime: startOfLastWeek.toISOString(),
      endTime: endOfLastWeek.toISOString()
    };
  }
  
  // Handle "earlier" by searching from beginning of today until now
  if (timeExpression.includes('earlier')) {
    return {
      startTime: today.toISOString(),
      endTime: now.toISOString()
    };
  }
  
  return {};
}

/**
 * Create the search prompt for a specific conversation
 */
export function createSearchPrompt(
  conversationId: string,
  storage: SqliteKVStore
): ChatPrompt {
  const searchModelConfig = getModelConfig('search');
  
  const prompt = new ChatPrompt({
    instructions: SEARCH_PROMPT,
    model: new OpenAIChatModel({
      model: searchModelConfig.model,
      apiKey: searchModelConfig.apiKey,
      endpoint: searchModelConfig.endpoint,
      apiVersion: searchModelConfig.apiVersion,
    }),
  })
  .function('search_messages', 'Search for messages in the conversation history', SEARCH_MESSAGES_SCHEMA, async (args: any) => {
    console.log(`🔍 FUNCTION CALL: search_messages with args:`, args);
    
    const { keywords, participants = [], start_time, end_time, max_results = 10 } = args;
    
    // Parse relative time expressions if no explicit times provided
    let actualStartTime = start_time;
    let actualEndTime = end_time;
    
    if (!start_time && !end_time) {
      // If user mentioned time expressions in keywords, try to parse them
      const timeKeywords = keywords.filter((k: string) => 
        k.toLowerCase().includes('today') || 
        k.toLowerCase().includes('yesterday') || 
        k.toLowerCase().includes('earlier') ||
        k.toLowerCase().includes('this week') ||
        k.toLowerCase().includes('last week')
      );
      
      if (timeKeywords.length > 0) {
        const timeExpression = timeKeywords[0];
        const parsedTime = parseRelativeTime(timeExpression);
        actualStartTime = parsedTime.startTime;
        actualEndTime = parsedTime.endTime;
        console.log(`🔍 Parsed time expression "${timeExpression}" to: ${actualStartTime} - ${actualEndTime}`);
      }
    }
    
    // Search for matching messages
    const matchingMessages = searchMessages(
      storage,
      conversationId,
      keywords,
      participants,
      actualStartTime,
      actualEndTime,
      max_results
    );
    
    if (matchingMessages.length === 0) {
      return JSON.stringify({
        status: 'no_results',
        message: 'No messages found matching your search criteria.',
        search_criteria: { keywords, participants, start_time: actualStartTime, end_time: actualEndTime }
      });
    }
    
    // Group messages by time periods for better context
    const groupedMessages = groupMessagesByTime(matchingMessages);
    
    // Create adaptive cards for the top results
    const adaptiveCards = matchingMessages.slice(0, 3).map(msg => {
      try {
        return createQuotedAdaptiveCardFromRecord(msg, conversationId);
      } catch (error) {
        console.warn(`⚠️ Failed to create adaptive card for message ${msg.id}:`, error);
        return null;
      }
    }).filter(card => card !== null);
    
    return JSON.stringify({
      status: 'success',
      total_results: matchingMessages.length,
      search_criteria: { keywords, participants, start_time: actualStartTime, end_time: actualEndTime },
      adaptive_cards: adaptiveCards,
      message_groups: groupedMessages.map(group => ({
        time_period: group.period,
        message_count: group.messages.length,
        messages: group.messages.map(msg => ({
          id: msg.id,
          activity_id: msg.activity_id,
          sender: msg.name,
          timestamp: msg.timestamp,
          content_preview: msg.content.substring(0, 150) + (msg.content.length > 150 ? '...' : ''),
          content_length: msg.content.length
        }))
      }))
    });
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
