import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SqliteKVStore } from '../storage/storage';
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

/**
 * Creates a specialized summarizer prompt with function tools for dynamic message retrieval
 */
export function createSummarizerPrompt(conversationId: string, storage: SqliteKVStore): ChatPrompt {
  console.log(`📋 Creating Summarizer Agent for conversation: ${conversationId}`);
  
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
    const recentMessages = storage.getRecentMessages(conversationId, limit);
    console.log(`📨 Retrieved ${recentMessages.length} recent messages`);
    return JSON.stringify({
      status: 'success',
      messages: recentMessages.map(msg => ({
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
    const rangeMessages = storage.getMessagesByTimeRange(conversationId, start_time, end_time);
    console.log(`📅 Retrieved ${rangeMessages.length} messages from time range`);
    return JSON.stringify({
      status: 'success',
      messages: rangeMessages.map(msg => ({
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
    const messagesToShow = storage.getRecentMessages(conversationId, displayCount);
    console.log(`📋 Formatting ${messagesToShow.length} messages for display`);
    const messageList = messagesToShow.map(msg => 
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
    const allMessages = storage.getAllMessagesWithTimestamps(conversationId);
    console.log(`📊 Retrieved ${allMessages.length} total messages for conversation summary`);
    return JSON.stringify({
      status: 'success',
      totalMessages: allMessages.length,
      conversationId: conversationId,
      oldestMessage: allMessages.length > 0 ? allMessages[0].timestamp : null,
      newestMessage: allMessages.length > 0 ? allMessages[allMessages.length - 1].timestamp : null,
      messagesByRole: allMessages.reduce((acc, msg) => {
        acc[msg.role] = (acc[msg.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      messagesByName: allMessages.reduce((acc, msg) => {
        acc[msg.name] = (acc[msg.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      participants: [...new Set(allMessages.map(msg => msg.name))],
      messages: allMessages.map(msg => ({
        timestamp: msg.timestamp,
        role: msg.role,
        name: msg.name,
        content: msg.content
      }))
    });
  });

  console.log(`📋 Summarizer Agent created with conversation history and functions`);
  return summarizerPrompt;
}

/**
 * Helper function to get recent messages with proper attribution
 */
export function getRecentMessagesWithNames(storage: SqliteKVStore, conversationId: string, limit: number = 10) {
  return storage.getRecentMessages(conversationId, limit);
}

/**
 * Helper function to get messages by time range with proper attribution
 */
export function getMessagesByTimeRangeWithNames(storage: SqliteKVStore, conversationId: string, startTime?: string, endTime?: string) {
  return storage.getMessagesByTimeRange(conversationId, startTime, endTime);
}

/**
 * Helper function to get all messages with timestamps and names
 */
export function getAllMessagesWithNames(storage: SqliteKVStore, conversationId: string) {
  return storage.getAllMessagesWithTimestamps(conversationId);
}
