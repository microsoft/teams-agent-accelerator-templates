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
      description: 'Keywords to search for in message content. Can include time expressions like "4 to 5pm", "between 2 and 3pm"'
    },
    participants: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Names of people who should be involved in the conversation'
    },
    start_time: {
      type: 'string' as const,
      description: 'Start time for search range (ISO format, optional). If not provided, will try to parse from keywords'
    },
    end_time: {
      type: 'string' as const,
      description: 'End time for search range (ISO format, optional). If not provided, will try to parse from keywords'
    },
    max_results: {
      type: 'number' as const,
      description: 'Maximum number of results to return (default 10)',
      default: 10
    },
    user_timezone: {
      type: 'string' as const,
      description: 'User timezone for time calculations (automatically detected from Teams)',
      default: 'UTC'
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
 * Now properly handles timezone conversions using the user's actual timezone from Teams
 */
function parseRelativeTime(timeExpression: string, userTimezone: string = 'UTC'): { startTime?: string, endTime?: string } {
  console.log(`🕐 Parsing relative time "${timeExpression}" in timezone: ${userTimezone}`);
  
  // Get current time in UTC
  const nowUTC = new Date();
  
  // Create a date in the user's timezone for "today"
  const nowInUserTZ = new Date(nowUTC.toLocaleString("en-US", { timeZone: userTimezone }));
  const todayInUserTZ = new Date(nowInUserTZ.getFullYear(), nowInUserTZ.getMonth(), nowInUserTZ.getDate());
  
  timeExpression = timeExpression.toLowerCase();
  
  if (timeExpression.includes('today') || timeExpression.includes('earlier today')) {
    // Start of today in user timezone
    const startOfToday = new Date(todayInUserTZ);
    // Convert back to UTC for storage
    const startOfTodayUTC = new Date(startOfToday.toLocaleString("en-US", { timeZone: "UTC" }));
    
    console.log(`🕐 Today range: ${startOfTodayUTC.toISOString()} to ${nowUTC.toISOString()}`);
    
    return {
      startTime: startOfTodayUTC.toISOString(),
      endTime: nowUTC.toISOString()
    };
  }
  
  if (timeExpression.includes('yesterday')) {
    const yesterday = new Date(todayInUserTZ);
    yesterday.setDate(yesterday.getDate() - 1);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    
    // Convert to UTC
    const yesterdayUTC = new Date(yesterday.toLocaleString("en-US", { timeZone: "UTC" }));
    const endOfYesterdayUTC = new Date(endOfYesterday.toLocaleString("en-US", { timeZone: "UTC" }));
    
    console.log(`🕐 Yesterday range: ${yesterdayUTC.toISOString()} to ${endOfYesterdayUTC.toISOString()}`);
    
    return {
      startTime: yesterdayUTC.toISOString(),
      endTime: endOfYesterdayUTC.toISOString()
    };
  }
  
  if (timeExpression.includes('this week')) {
    const startOfWeek = new Date(todayInUserTZ);
    startOfWeek.setDate(todayInUserTZ.getDate() - todayInUserTZ.getDay());
    
    // Convert to UTC
    const startOfWeekUTC = new Date(startOfWeek.toLocaleString("en-US", { timeZone: "UTC" }));
    
    console.log(`🕐 This week range: ${startOfWeekUTC.toISOString()} to ${nowUTC.toISOString()}`);
    
    return {
      startTime: startOfWeekUTC.toISOString(),
      endTime: nowUTC.toISOString()
    };
  }
  
  if (timeExpression.includes('last week')) {
    const startOfLastWeek = new Date(todayInUserTZ);
    startOfLastWeek.setDate(todayInUserTZ.getDate() - todayInUserTZ.getDay() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(endOfLastWeek.getDate() + 6);
    endOfLastWeek.setHours(23, 59, 59, 999);
    
    // Convert to UTC
    const startOfLastWeekUTC = new Date(startOfLastWeek.toLocaleString("en-US", { timeZone: "UTC" }));
    const endOfLastWeekUTC = new Date(endOfLastWeek.toLocaleString("en-US", { timeZone: "UTC" }));
    
    console.log(`🕐 Last week range: ${startOfLastWeekUTC.toISOString()} to ${endOfLastWeekUTC.toISOString()}`);
    
    return {
      startTime: startOfLastWeekUTC.toISOString(),
      endTime: endOfLastWeekUTC.toISOString()
    };
  }
  
  // Handle "earlier" by searching from beginning of today until now
  if (timeExpression.includes('earlier')) {
    const startOfToday = new Date(todayInUserTZ);
    const startOfTodayUTC = new Date(startOfToday.toLocaleString("en-US", { timeZone: "UTC" }));
    
    console.log(`🕐 Earlier range: ${startOfTodayUTC.toISOString()} to ${nowUTC.toISOString()}`);
    
    return {
      startTime: startOfTodayUTC.toISOString(),
      endTime: nowUTC.toISOString()
    };
  }
  
  return {};
}

/**
 * Parse specific time ranges like "4 to 5pm", "between 2 and 3pm", etc.
 * Uses the user's actual timezone from Teams activity data
 */
function parseSpecificTimeRange(timeExpression: string, userTimezone: string = 'UTC'): { startTime?: string, endTime?: string } {
  console.log(`🕐 Parsing specific time range "${timeExpression}" in timezone: ${userTimezone}`);
  
  timeExpression = timeExpression.toLowerCase();
  
  // Patterns for time ranges
  const timeRangePatterns = [
    /between\s+(\d{1,2})(?::(\d{2}))?\s*(?:and|to)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
    /(\d{1,2})(?::(\d{2}))?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
    /from\s+(\d{1,2})(?::(\d{2}))?\s*(?:to|until)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  ];
  
  for (const pattern of timeRangePatterns) {
    const match = timeExpression.match(pattern);
    if (match) {
      let startHour = parseInt(match[1]);
      const startMinute = parseInt(match[2] || '0');
      let endHour = parseInt(match[3]);
      const endMinute = parseInt(match[4] || '0');
      const period = match[5]?.toLowerCase();
      
      // Handle AM/PM conversion
      if (period === 'pm' && startHour < 12) startHour += 12;
      if (period === 'am' && startHour === 12) startHour = 0;
      if (period === 'pm' && endHour < 12) endHour += 12;
      if (period === 'am' && endHour === 12) endHour = 0;
      
      // Assume PM if no period specified and hours are typical business hours
      if (!period) {
        if (startHour >= 1 && startHour <= 11) startHour += 12;
        if (endHour >= 1 && endHour <= 11) endHour += 12;
      }
      
      // Get today's date in user's timezone
      const nowUTC = new Date();
      const nowInUserTZ = new Date(nowUTC.toLocaleString("en-US", { timeZone: userTimezone }));
      const todayInUserTZ = new Date(nowInUserTZ.getFullYear(), nowInUserTZ.getMonth(), nowInUserTZ.getDate());
      
      // Create start and end times in user's timezone
      const startTimeInUserTZ = new Date(todayInUserTZ);
      startTimeInUserTZ.setHours(startHour, startMinute, 0, 0);
      
      const endTimeInUserTZ = new Date(todayInUserTZ);
      endTimeInUserTZ.setHours(endHour, endMinute, 59, 999);
      
      // Convert to UTC for database storage
      const startTimeUTC = new Date(startTimeInUserTZ.toLocaleString("en-US", { timeZone: "UTC" }));
      const endTimeUTC = new Date(endTimeInUserTZ.toLocaleString("en-US", { timeZone: "UTC" }));
      
      console.log(`🕐 Parsed time range "${timeExpression}":`, {
        userTimezone,
        localStart: startTimeInUserTZ.toLocaleString(),
        localEnd: endTimeInUserTZ.toLocaleString(),
        utcStart: startTimeUTC.toISOString(),
        utcEnd: endTimeUTC.toISOString()
      });
      
      return {
        startTime: startTimeUTC.toISOString(),
        endTime: endTimeUTC.toISOString()
      };
    }
  }
  
  return {};
}

/**
 * Create the search prompt for a specific conversation
 */
export function createSearchPrompt(
  conversationId: string,
  storage: SqliteKVStore,
  userTimezone?: string
): ChatPrompt {
  const searchModelConfig = getModelConfig('search');
  
  // Use provided timezone or default to UTC if not available
  const defaultTimezone = userTimezone || 'UTC';
  
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
    
    const { keywords, participants = [], start_time, end_time, max_results = 10, user_timezone = defaultTimezone } = args;
    
    // Parse relative time expressions if no explicit times provided
    let actualStartTime = start_time;
    let actualEndTime = end_time;
    
    if (!start_time && !end_time) {
      // First, check for specific time ranges like "4 to 5pm"
      const joinedKeywords = keywords.join(' ');
      const specificTimeRange = parseSpecificTimeRange(joinedKeywords, user_timezone);
      
      if (specificTimeRange.startTime && specificTimeRange.endTime) {
        actualStartTime = specificTimeRange.startTime;
        actualEndTime = specificTimeRange.endTime;
        console.log(`🔍 Parsed specific time range from keywords: ${actualStartTime} - ${actualEndTime} (timezone: ${user_timezone})`);
      } else {
        // If no specific time range, try relative time expressions
        const timeKeywords = keywords.filter((k: string) => 
          k.toLowerCase().includes('today') || 
          k.toLowerCase().includes('yesterday') || 
          k.toLowerCase().includes('earlier') ||
          k.toLowerCase().includes('this week') ||
          k.toLowerCase().includes('last week')
        );
        
        if (timeKeywords.length > 0) {
          const timeExpression = timeKeywords[0];
          const parsedTime = parseRelativeTime(timeExpression, user_timezone);
          actualStartTime = parsedTime.startTime;
          actualEndTime = parsedTime.endTime;
          console.log(`🔍 Parsed relative time expression "${timeExpression}" to: ${actualStartTime} - ${actualEndTime} (timezone: ${user_timezone})`);
        }
      }
    }
    
    // Filter out time-related keywords from content search to avoid false matches
    const contentKeywords = keywords.filter((k: string) => {
      const keyword = k.toLowerCase();
      return !keyword.includes('between') && 
             !keyword.includes('from') && 
             !keyword.includes(' to ') && 
             !keyword.includes(' and ') && 
             !keyword.match(/\d+\s*(am|pm)/) &&
             !keyword.includes('today') && 
             !keyword.includes('yesterday') && 
             !keyword.includes('earlier') &&
             !keyword.includes('this week') &&
             !keyword.includes('last week');
    });
    
    // Search for matching messages
    const matchingMessages = searchMessages(
      storage,
      conversationId,
      contentKeywords.length > 0 ? contentKeywords : keywords, // Use original keywords if no content keywords remain
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
