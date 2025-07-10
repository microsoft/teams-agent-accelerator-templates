import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { getRecentMessages, getMessagesByTimeRange, getMessagesWithTimestamps } from '../storage/message';
import { SUMMARY_PROMPT } from '../agent/instructions';
import { getModelConfig } from '../utils/config';

// Function schemas for the summarizer
const GET_RECENT_MESSAGES_SCHEMA = {
  type: 'object' as const,
  properties: {
    limit: {
      type: 'number' as const,
      description: 'Number of recent messages to retrieve (default: 5, max: 20)',
      minimum: 1,
      maximum: 20
    }
  }
};

const GET_MESSAGES_BY_TIME_RANGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    start_time: {
      type: 'string' as const,
      description: 'Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z). Optional.'
    },
    end_time: {
      type: 'string' as const,
      description: 'End time in ISO format (e.g., 2024-01-01T23:59:59.999Z). Optional.'
    }
  }
};

const SHOW_RECENT_MESSAGES_SCHEMA = {
  type: 'object' as const,
  properties: {
    count: {
      type: 'number' as const,
      description: 'Number of recent messages to display (default: 5)',
      minimum: 1,
      maximum: 20
    }
  }
};

const EMPTY_SCHEMA = {
  type: 'object' as const,
  properties: {}
};

const GET_MESSAGES_BY_RELATIVE_TIME_SCHEMA = {
  type: 'object' as const,
  properties: {
    time_expression: {
      type: 'string' as const,
      description: 'Relative time expression like "today", "yesterday", "this week" - will be parsed using user timezone'
    }
  },
  required: ['time_expression']
};

/**
 * Creates a specialized summarizer prompt with function tools for dynamic message retrieval
 */
export function createSummarizerPrompt(conversationId: string, userTimezone?: string): ChatPrompt {
  console.log(`📋 Creating Summarizer Agent for conversation: ${conversationId}`);
  if (userTimezone) {
    console.log(`🕒 Using timezone: ${userTimezone}`);
  }
  
  // Note: We don't load conversation history upfront to avoid redundancy and double execution
  // Instead, we let the AI use function tools to fetch exactly what it needs
  console.log(`🔧 Summarizer will use function tools for dynamic message retrieval`);

  const summarizerModelConfig = getModelConfig('summarizer');

  // Create the specialized summarizer prompt with function tools only
  const summarizerPrompt = new ChatPrompt({
    instructions: SUMMARY_PROMPT,
    // No pre-loaded messages - AI will fetch what it needs using function tools
    model: new OpenAIChatModel({
      model: summarizerModelConfig.model,
      apiKey: summarizerModelConfig.apiKey,
      endpoint: summarizerModelConfig.endpoint,
      apiVersion: summarizerModelConfig.apiVersion,
    }),
  })
  .function('get_recent_messages', 'Retrieve recent messages from the conversation history with timestamps', GET_RECENT_MESSAGES_SCHEMA, async (args: any) => {
    const limit = args.limit || 5;
    console.log(`🔍 FUNCTION CALL: get_recent_messages with limit=${limit} for conversation=${conversationId}`);
    const recentMessages = getRecentMessages(conversationId, limit);
    console.log(`📨 Retrieved ${recentMessages.length} recent messages`);
    return JSON.stringify({
      status: 'success',
      messages: recentMessages.map((msg: any) => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      })),
      count: recentMessages.length
    });
  })
  .function('get_messages_by_time_range', 'Retrieve messages from a specific time range', GET_MESSAGES_BY_TIME_RANGE_SCHEMA, async (args: any) => {
    const { start_time, end_time } = args;
    console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${conversationId}`);
    const rangeMessages = getMessagesByTimeRange(conversationId, start_time, end_time);
    console.log(`📅 Retrieved ${rangeMessages.length} messages from time range`);
    return JSON.stringify({
      status: 'success',
      messages: rangeMessages.map((msg: any) => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      })),
      count: rangeMessages.length,
      timeRange: { start: start_time, end: end_time }
    });
  })
  .function('show_recent_messages', 'Display recent messages in a formatted way for the user', SHOW_RECENT_MESSAGES_SCHEMA, async (args: any) => {
    const displayCount = args.count || 5;
    console.log(`🔍 FUNCTION CALL: show_recent_messages with count=${displayCount} for conversation=${conversationId}`);
    const messagesToShow = getRecentMessages(conversationId, displayCount);
    console.log(`📋 Formatting ${messagesToShow.length} messages for display`);
    const messageList = messagesToShow.map((msg: any) => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.name} (${msg.role}): ${msg.content}`
    ).join('\n');
    
    return JSON.stringify({
      status: 'success',
      formatted_messages: messageList || 'No messages found',
      count: messagesToShow.length,
      display_text: `📅 Recent messages (${messagesToShow.length}):\n${messageList || 'No messages found'}`
    });
  })
  .function('summarize_conversation', 'Get a summary of the conversation with message counts and time span', EMPTY_SCHEMA, async (_args: any) => {
    console.log(`🔍 FUNCTION CALL: summarize_conversation for conversation=${conversationId}`);
    const allMessages = getMessagesWithTimestamps(conversationId);
    console.log(`📊 Retrieved ${allMessages.length} total messages for conversation summary`);
    return JSON.stringify({
      status: 'success',
      totalMessages: allMessages.length,
      conversationId: conversationId,
      oldestMessage: allMessages.length > 0 ? allMessages[0].timestamp : null,
      newestMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].timestamp : null,
      messagesByRole: allMessages.reduce((acc: any, msg: any) => {
        acc[msg.role] = (acc[msg.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      messagesByName: allMessages.reduce((acc: any, msg: any) => {
        acc[msg.name] = (acc[msg.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      participants: [...new Set(allMessages.map((msg: any) => msg.name))],
      messages: allMessages.map((msg: any) => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      }))
    });
  })
  .function('get_messages_by_relative_time', 'Retrieve messages based on a relative time expression', GET_MESSAGES_BY_RELATIVE_TIME_SCHEMA, async (args: any) => {
    const { time_expression } = args;
    console.log(`🔍 FUNCTION CALL: get_messages_by_relative_time with expression="${time_expression}" for conversation=${conversationId}`);
    
    // Parse the relative time expression to get start and end times
    const { startTime, endTime } = parseRelativeTimeForSummary(time_expression, userTimezone);
    console.log(`⏳ Time range for "${time_expression}": ${startTime} to ${endTime}`);
    
    const rangeMessages = getMessagesByTimeRange(conversationId, startTime, endTime);
    console.log(`📅 Retrieved ${rangeMessages.length} messages for relative time range`);
    return JSON.stringify({
      status: 'success',
      messages: rangeMessages.map((msg: any) => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      })),
      count: rangeMessages.length,
      timeRange: { start: startTime, end: endTime }
    });
  });

  console.log(`📋 Summarizer Agent created with conversation history and functions`);
  return summarizerPrompt;
}

/**
 * Parse relative time expressions for summaries with timezone awareness
 */
function parseRelativeTimeForSummary(timeExpression: string, userTimezone: string = 'UTC'): { startTime: string, endTime: string } {
  const nowUTC = new Date();
  const nowInUserTZ = new Date(nowUTC.toLocaleString("en-US", { timeZone: userTimezone }));
  const todayInUserTZ = new Date(nowInUserTZ.getFullYear(), nowInUserTZ.getMonth(), nowInUserTZ.getDate());
  
  timeExpression = timeExpression.toLowerCase();
  
  if (timeExpression.includes('today')) {
    const startOfToday = new Date(todayInUserTZ);
    const startOfTodayUTC = new Date(startOfToday.toLocaleString("en-US", { timeZone: "UTC" }));
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
    
    const yesterdayUTC = new Date(yesterday.toLocaleString("en-US", { timeZone: "UTC" }));
    const endOfYesterdayUTC = new Date(endOfYesterday.toLocaleString("en-US", { timeZone: "UTC" }));
    return {
      startTime: yesterdayUTC.toISOString(),
      endTime: endOfYesterdayUTC.toISOString()
    };
  }
  
  if (timeExpression.includes('this week')) {
    const startOfWeek = new Date(todayInUserTZ);
    startOfWeek.setDate(todayInUserTZ.getDate() - todayInUserTZ.getDay());
    const startOfWeekUTC = new Date(startOfWeek.toLocaleString("en-US", { timeZone: "UTC" }));
    return {
      startTime: startOfWeekUTC.toISOString(),
      endTime: nowUTC.toISOString()
    };
  }
  
  // Default to last 24 hours
  const yesterday24h = new Date(nowUTC.getTime() - 24 * 60 * 60 * 1000);
  return {
    startTime: yesterday24h.toISOString(),
    endTime: nowUTC.toISOString()
  };
}
