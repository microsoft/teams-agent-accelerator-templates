import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { MessageRecord } from '../storage/storage';
import { getMessagesByTimeRange } from '../storage/message';
import { SEARCH_PROMPT } from '../agent/prompt';
import { BaseCapability, CapabilityOptions } from './capability';
import { getContextById } from '../utils/messageContext';

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
 * Create a Citation object from a message record for display in Teams
 */
export function createCitationFromRecord(message: MessageRecord, conversationId: string): CitationAppearance {
  if (!message.activity_id) {
    throw new Error("Message record missing activity_id for deep linking");
  }

  const messageText = message.content ?? "<no message text>";
  const senderName = message.name ?? "Unknown";
  
  // Format timestamp for context
  const messageDate = new Date(message.timestamp);
  const formattedDate = messageDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  // Build deep link with chat context
  const chatId = conversationId;
  const messageId = message.activity_id;
  const contextParam = encodeURIComponent(JSON.stringify({ contextType: "chat" }));
  const deepLink = `https://teams.microsoft.com/l/message/${encodeURIComponent(chatId)}/${messageId}?context=${contextParam}`;

  // Create citation with message content and timestamp context
  const maxContentLength = 120; // Leave room for timestamp info
  const truncatedContent = messageText.length > maxContentLength ? 
    messageText.substring(0, maxContentLength) + '...' : 
    messageText;
  const abstractText = `${formattedDate}: "${truncatedContent}"`;
  
  const titleText = `Message from ${senderName}`.length > 80 ? `${senderName}` : `Message from ${senderName}`;

  return {
    name: titleText,
    url: deepLink,
    abstract: abstractText,
    keywords: senderName ? [senderName] : undefined
  };
}

/**
 * Search for messages based on keywords and participants
 */
function searchMessages(
  conversationId: string,
  keywords: string[],
  participants: string[] = [],
  startTime?: string,
  endTime?: string,
  maxResults: number = 10
): MessageRecord[] {
  try {
    // Get messages in the time range using centralized function
    const messages = getMessagesByTimeRange(conversationId, startTime, endTime);
    
    // Filter by keywords (case-insensitive)
    let filteredMessages = messages.filter((msg: MessageRecord) => {
      const content = msg.content.toLowerCase();
      return keywords.some(keyword => content.includes(keyword.toLowerCase()));
    });
    
    // Filter by participants if specified
    if (participants.length > 0) {
      filteredMessages = filteredMessages.filter((msg: MessageRecord) => {
        const name = msg.name.toLowerCase();
        return participants.some(participant => 
          name.includes(participant.toLowerCase()) || 
          participant.toLowerCase().includes(name)
        );
      });
    }
    
    // Sort by timestamp (most recent first) and limit results
    filteredMessages.sort((a: MessageRecord, b: MessageRecord) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return filteredMessages.slice(0, maxResults);
    
  } catch (error) {
    console.error(`❌ Error searching messages:`, error);
    return [];
  }
}



/**
 * Refactored Search Capability that implements the unified capability interface
 */
export class SearchCapability extends BaseCapability {
  readonly name = 'search';
  
  createPrompt(contextID: string, options: CapabilityOptions = {}): ChatPrompt {
    const messageContext = getContextById(contextID);
    if (!messageContext) {
      throw new Error(`Context not found for activity ID: ${contextID}`);
    }
    
    this.logInit(messageContext);
    
    const searchModelConfig = this.getModelConfig('search');
    
    // Build additional time context if pre-calculated times are provided
    let timeContext = '';
    if (options.calculatedStartTime && options.calculatedEndTime) {
      console.log(`🕒 Search Capability received pre-calculated time range: ${options.timespanDescription || 'calculated timespan'} (${options.calculatedStartTime} to ${options.calculatedEndTime})`);
      timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${options.calculatedStartTime}
- End: ${options.calculatedEndTime}
- Description: ${options.timespanDescription || 'calculated timespan'}

When searching messages, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
    }
    
    // Get current date and timezone info for the LLM
    const currentDate = messageContext.currentDateTime;
    
    const instructions = `${SEARCH_PROMPT}

CURRENT CONTEXT:
- Current date/time: ${currentDate}
- When calculating time ranges like "earlier today", "yesterday", use the current time above
- Always provide start_time and end_time in ISO format when searching for time-based queries${timeContext}`;
    
    const prompt = new ChatPrompt({
      instructions,
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
        messageContext.conversationKey,
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

      // Create citations for the first few results (limit to 5 to avoid overwhelming the user)
      const messagesToCite = matchingMessages.slice(0, 5);
      const citations = messagesToCite.map(msg => createCitationFromRecord(msg, messageContext.conversationKey));
      
      // If we have an array to store citations, add them there for the manager to access
      if (options.citationsArray) {
        options.citationsArray.push(...citations);
      }
      
      // Return just the summary text (citations are handled via the shared array)
      return response;
    });
    
    console.log(`🔍 Search Capability created with unified interface`);
    return prompt;
  }
  
  getFunctionSchemas(): Array<{name: string, schema: any}> {
    return [
      { name: 'search_messages', schema: SEARCH_MESSAGES_SCHEMA }
    ];
  }
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
