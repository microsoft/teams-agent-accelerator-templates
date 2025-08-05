import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { getRecentMessages, getMessagesByTimeRange, getMessagesWithTimestamps } from '../../storage/message';
import { SUMMARY_PROMPT } from './prompt';
import { 
  GET_RECENT_MESSAGES_SCHEMA, 
  GET_MESSAGES_BY_TIME_RANGE_SCHEMA, 
  SHOW_RECENT_MESSAGES_SCHEMA, 
  EMPTY_SCHEMA,
  SUMMARIZER_DELEGATION_SCHEMA 
} from './schema';
import { BaseCapability, CapabilityOptions, CapabilityDefinition } from '../capability';
import { MessageContext } from '../../utils/messageContext';

/**
 * Refactored Summarizer Capability that implements the unified capability interface
 */
export class SummarizerCapability extends BaseCapability {
  readonly name = 'summarizer';
  
  createPrompt(messageContext: MessageContext, options: CapabilityOptions = {}): ChatPrompt {
    if (!messageContext) {
      throw new Error(`Message context is required for summarizer capability`);
    }
    
    this.logInit(messageContext);
    
    const summarizerModelConfig = this.getModelConfig('summarizer');
    
    // Build additional time context if pre-calculated times are provided
    let timeContext = '';
    if (options.calculatedStartTime && options.calculatedEndTime) {
      console.log(`🕒 Summarizer Capability received pre-calculated time range: ${options.timespanDescription || 'calculated timespan'} (${options.calculatedStartTime} to ${options.calculatedEndTime})`);
      timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${options.calculatedStartTime}
- End: ${options.calculatedEndTime}
- Description: ${options.timespanDescription || 'calculated timespan'}

When retrieving messages for summarization, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
    }
    
    const instructions = SUMMARY_PROMPT + timeContext;
    
    const prompt = new ChatPrompt({
      instructions,
      model: new OpenAIChatModel({
        model: summarizerModelConfig.model,
        apiKey: summarizerModelConfig.apiKey,
        endpoint: summarizerModelConfig.endpoint,
        apiVersion: summarizerModelConfig.apiVersion,
      }),
    })
    .function('get_recent_messages', 'Retrieve recent messages from the conversation history with timestamps', GET_RECENT_MESSAGES_SCHEMA, async (args: any) => {
      const limit = args.limit || 5;
      console.log(`🔍 FUNCTION CALL: get_recent_messages with limit=${limit} for conversation=${messageContext.conversationKey}`);
      const recentMessages = getRecentMessages(messageContext.conversationKey, limit);
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
      console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${messageContext.conversationKey}`);
      const rangeMessages = getMessagesByTimeRange(messageContext.conversationKey, start_time, end_time);
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
      console.log(`🔍 FUNCTION CALL: show_recent_messages with count=${displayCount} for conversation=${messageContext.conversationKey}`);
      const messagesToShow = getRecentMessages(messageContext.conversationKey, displayCount);
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
      console.log(`🔍 FUNCTION CALL: summarize_conversation for conversation=${messageContext.conversationKey}`);
      const allMessages = getMessagesWithTimestamps(messageContext.conversationKey);
      console.log(`📊 Retrieved ${allMessages.length} total messages for conversation summary`);
      return JSON.stringify({
        status: 'success',
        totalMessages: allMessages.length,
        conversationId: messageContext.conversationKey,
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
    });

    console.log(`📋 Summarizer Capability created with unified interface`);
    return prompt;
  }
  
  getFunctionSchemas(): Array<{name: string, schema: any}> {
    return [
      { name: 'get_recent_messages', schema: GET_RECENT_MESSAGES_SCHEMA },
      { name: 'get_messages_by_time_range', schema: GET_MESSAGES_BY_TIME_RANGE_SCHEMA },
      { name: 'show_recent_messages', schema: SHOW_RECENT_MESSAGES_SCHEMA },
      { name: 'summarize_conversation', schema: EMPTY_SCHEMA }
    ];
  }
}

// Capability definition for manager registration
export const SUMMARIZER_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: 'delegate_to_summarizer',
  description: 'Delegate conversation analysis, summarization, or message retrieval tasks to the Summarizer Capability',
  schema: SUMMARIZER_DELEGATION_SCHEMA,
  handler: async (args: any, context: MessageContext, state: any) => {
    state.delegatedCapability = 'summarizer';
    const summarizerCapability = new SummarizerCapability();
    const result = await summarizerCapability.processRequest(context, {
      calculatedStartTime: args.calculated_start_time,
      calculatedEndTime: args.calculated_end_time,
      timespanDescription: args.timespan_description
    });
    if (result.error) {
      console.error(`❌ Error in Summarizer Capability: ${result.error}`);
      return `Error in Summarizer Capability: ${result.error}`;
    }
    return result.response || 'No response from Summarizer Capability';
  }
};
