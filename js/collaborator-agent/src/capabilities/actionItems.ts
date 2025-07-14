import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { ActionItem } from '../storage/storage';
import { getMessagesByTimeRange } from '../storage/message';
import { ACTION_ITEMS_PROMPT } from '../agent/instructions';
import { BaseCapability, CapabilityConfig } from './capability';

// Function schemas for the action items capability
const ANALYZE_FOR_ACTION_ITEMS_SCHEMA = {
  type: 'object' as const,
  properties: {
    start_time: {
      type: 'string' as const,
      description: 'Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z). Optional - defaults to last 24 hours.'
    },
    end_time: {
      type: 'string' as const,
      description: 'End time in ISO format (e.g., 2024-01-01T23:59:59.999Z). Optional - defaults to now.'
    }
  }
};

const CREATE_ACTION_ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: {
      type: 'string' as const,
      description: 'Brief title for the action item'
    },
    description: {
      type: 'string' as const,
      description: 'Detailed description of what needs to be done'
    },
    assigned_to: {
      type: 'string' as const,
      description: 'Name of the person this action item is assigned to'
    },
    priority: {
      type: 'string' as const,
      enum: ['low', 'medium', 'high', 'urgent'],
      description: 'Priority level of the action item'
    },
    due_date: {
      type: 'string' as const,
      description: 'Optional due date in ISO format or relative expression (e.g., "tomorrow", "end of week", "next Monday"). Relative expressions are parsed using the user\'s timezone.'
    }
  },
  required: ['title', 'description', 'assigned_to', 'priority']
};

const GET_ACTION_ITEMS_SCHEMA = {
  type: 'object' as const,
  properties: {
    assigned_to: {
      type: 'string' as const,
      description: 'Filter by person assigned to (optional)'
    },
    status: {
      type: 'string' as const,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      description: 'Filter by status (optional)'
    }
  }
};

const UPDATE_ACTION_ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    action_item_id: {
      type: 'number' as const,
      description: 'ID of the action item to update'
    },
    new_status: {
      type: 'string' as const,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      description: 'New status for the action item'
    }
  },
  required: ['action_item_id', 'new_status']
};

const GET_CHAT_MEMBERS_SCHEMA = {
  type: 'object' as const,
  properties: {}
};



/**
 * Refactored Action Items Capability that implements the unified capability interface
 */
export class ActionItemsCapability extends BaseCapability {
  readonly name = 'action_items';
  
  createPrompt(config: CapabilityConfig): ChatPrompt {
    this.logInit(config.conversationId, config.userTimezone);
    
    if (!config.storage) {
      throw new Error('Action Items capability requires storage configuration');
    }
    
    const actionItemsModelConfig = this.getModelConfig('actionItems');
    
    // Build additional time context if pre-calculated times are provided
    let timeContext = '';
    if (config.calculatedStartTime && config.calculatedEndTime) {
      console.log(`🕒 Action Items Capability received pre-calculated time range: ${config.timespanDescription || 'calculated timespan'} (${config.calculatedStartTime} to ${config.calculatedEndTime})`);
      timeContext = `

IMPORTANT: Pre-calculated time range available:
- Start: ${config.calculatedStartTime}
- End: ${config.calculatedEndTime}
- Description: ${config.timespanDescription || 'calculated timespan'}

When analyzing messages for action items or performing any time-based queries, use these exact timestamps instead of calculating your own. This ensures consistency with the Manager's time calculations and reduces token usage.`;
    }
    
    // Adjust instructions based on conversation type
    const baseInstructions = config.isPersonalChat 
      ? `You are a personal action items assistant for ${config.currentUserName || 'the user'}. 
         
         Your role is to help them:
         - View their personal action items assigned to them across all conversations
         - Update the status of their action items  
         - Get summaries of their workload
         - Filter action items by status, priority, or due date
         
         This is a personal 1:1 conversation, so focus on THEIR action items only.
         Be helpful, concise, and focused on their personal productivity.`
      : ACTION_ITEMS_PROMPT;
      
    const instructions = baseInstructions + timeContext;
    
    const prompt = new ChatPrompt({
      instructions,
      model: new OpenAIChatModel({
        model: actionItemsModelConfig.model,
        apiKey: actionItemsModelConfig.apiKey,
        endpoint: actionItemsModelConfig.endpoint,
        apiVersion: actionItemsModelConfig.apiVersion,
      }),
    })
    .function('analyze_for_action_items', 'Analyze conversation messages in a time range to identify potential action items', ANALYZE_FOR_ACTION_ITEMS_SCHEMA, async (args: any) => {
      console.log(`🔍 FUNCTION CALL: analyze_for_action_items for conversation=${config.conversationId}`);
      
      const { start_time, end_time } = args;
      console.log(`🔍 FUNCTION CALL: get_messages_by_time_range with start=${start_time}, end=${end_time} for conversation=${config.conversationId}`);
      const messages = getMessagesByTimeRange(config.conversationId, start_time, end_time);
      console.log(`📅 Retrieved ${messages.length} messages from time range`);
      
      // Get existing action items to avoid duplicates
      const existingActionItems = config.storage!.getActionItemsByConversation(config.conversationId);
      
      return JSON.stringify({
        status: 'success',
        time_range: { start_time: start_time, end_time: end_time },
        messages: messages.map(msg => ({
          timestamp: msg.timestamp,
          role: msg.role,
          name: msg.name,
          content: msg.content
        })),
        existing_action_items: existingActionItems.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          assigned_to: item.assigned_to,
          status: item.status,
          priority: item.priority,
          due_date: item.due_date,
          created_at: item.created_at
        })),
        available_members: config.availableMembers || []
      });
    })
    .function('create_action_item', 'Create a new action item and assign it to a team member', CREATE_ACTION_ITEM_SCHEMA, async (args: any) => {
      console.log(`✅ FUNCTION CALL: create_action_item - "${args.title}" assigned to ${args.assigned_to}`);
      
      try {
        // Find the user ID for the assigned person
        let assignedToId: string | undefined;
        if (config.isPersonalChat && config.currentUserId) {
          // In personal chat, assign to the current user
          assignedToId = config.currentUserId;
        } else {
          // In group chat, find the user ID from available members
          const assignedMember = (config.availableMembers || []).find(member => 
            member.name === args.assigned_to || 
            member.name.toLowerCase() === args.assigned_to.toLowerCase()
          );
          assignedToId = assignedMember?.id;
        }
        
        console.log(`🔍 Found user ID for "${args.assigned_to}": ${assignedToId || 'Not found'}`);
        
        // Parse due_date with timezone awareness if it's a relative expression
        let parsedDueDate = args.due_date;
        if (args.due_date && config.userTimezone) {
          const timezoneParsedDate = parseDeadlineWithTimezone(args.due_date, config.userTimezone);
          if (timezoneParsedDate) {
            parsedDueDate = timezoneParsedDate;
            console.log(`🕒 Parsed deadline "${args.due_date}" to ${parsedDueDate} (timezone: ${config.userTimezone})`);
          }
        }
        
        const actionItem = config.storage!.createActionItem({
          conversation_id: config.conversationId,
          title: args.title,
          description: args.description,
          assigned_to: args.assigned_to,
          assigned_to_id: assignedToId,
          assigned_by: config.currentUserName || 'AI Action Items Capability',
          status: 'pending',
          priority: args.priority,
          due_date: parsedDueDate
        });
        
        return JSON.stringify({
          status: 'success',
          action_item: {
            id: actionItem.id,
            title: actionItem.title,
            description: actionItem.description,
            assigned_to: actionItem.assigned_to,
            priority: actionItem.priority,
            due_date: actionItem.due_date,
            created_at: actionItem.created_at
          },
          message: `Action item "${args.title}" has been created and assigned to ${args.assigned_to}`
        });
      } catch (error) {
        console.error('❌ Error creating action item:', error);
        return JSON.stringify({
          status: 'error',
          message: 'Failed to create action item',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    })
    .function('get_action_items', 'Retrieve action items for this conversation, optionally filtered by assignee or status', GET_ACTION_ITEMS_SCHEMA, async (args: any) => {
      console.log(`🔍 FUNCTION CALL: get_action_items with filters:`, args);
      
      let actionItems: ActionItem[];
      
      if (config.isPersonalChat && config.currentUserId) {
        // In personal chat, only show the user's own action items across all conversations
        actionItems = config.storage!.getActionItemsByUserId(config.currentUserId, args.status);
        console.log(`👤 Personal chat: Retrieved ${actionItems.length} action items for user ${config.currentUserName}`);
      } else {
        // In group chat, handle normal conversation-based logic
        if (args.assigned_to && args.assigned_to !== 'all') {
          // Get action items for specific user
          actionItems = config.storage!.getActionItemsForUser(args.assigned_to, args.status);
        } else {
          // Get all action items for this conversation
          actionItems = config.storage!.getActionItemsByConversation(config.conversationId);
          if (args.status) {
            actionItems = actionItems.filter(item => item.status === args.status);
          }
        }
      }
      
      return JSON.stringify({
        status: 'success',
        conversation_type: config.isPersonalChat ? 'personal' : 'group',
        filters: args,
        action_items: actionItems.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          assigned_to: item.assigned_to,
          assigned_by: item.assigned_by,
          status: item.status,
          priority: item.priority,
          due_date: item.due_date,
          created_at: item.created_at,
          updated_at: item.updated_at,
          conversation_id: config.isPersonalChat ? item.conversation_id : undefined // Show source conversation in personal view
        })),
        count: actionItems.length
      });
    })
    .function('update_action_item_status', 'Update the status of an existing action item', UPDATE_ACTION_ITEM_SCHEMA, async (args: any) => {
      console.log(`🔄 FUNCTION CALL: update_action_item_status - Item #${args.action_item_id} to ${args.new_status}`);
      
      const success = config.storage!.updateActionItemStatus(args.action_item_id, args.new_status, 'AI Action Items Capability');
      
      if (success) {
        const updatedItem = config.storage!.getActionItemById(args.action_item_id);
        return JSON.stringify({
          status: 'success',
          action_item: updatedItem,
          message: `Action item #${args.action_item_id} status updated to: ${args.new_status}`
        });
      } else {
        return JSON.stringify({
          status: 'error',
          message: `Failed to update action item #${args.action_item_id}. Item may not exist.`
        });
      }
    })
    .function('get_chat_members', 'Get the list of available members in this chat for action item assignment', GET_CHAT_MEMBERS_SCHEMA, async () => {
      console.log(`👥 FUNCTION CALL: get_chat_members for conversation=${config.conversationId}`);
      
      return JSON.stringify({
        status: 'success',
        available_members: config.availableMembers || [],
        member_count: (config.availableMembers || []).length,
        guidance: "These are the available members who can be assigned action items. Choose assignees based on their expertise, availability, and the nature of the task."
      });
    });

    console.log(`🎯 Action Items Capability created with unified interface`);
    return prompt;
  }
  
  getFunctionSchemas(): Array<{name: string, schema: any}> {
    return [
      { name: 'analyze_for_action_items', schema: ANALYZE_FOR_ACTION_ITEMS_SCHEMA },
      { name: 'create_action_item', schema: CREATE_ACTION_ITEM_SCHEMA },
      { name: 'get_action_items', schema: GET_ACTION_ITEMS_SCHEMA },
      { name: 'update_action_item_status', schema: UPDATE_ACTION_ITEM_SCHEMA },
      { name: 'get_chat_members', schema: GET_CHAT_MEMBERS_SCHEMA }
    ];
  }
}

/**
 * Helper function to get conversation participants using Teams API
 */
export async function getConversationParticipantsFromAPI(api: any, conversationId: string): Promise<Array<{name: string, id: string}>> {
  try {
    console.log(`👥 Fetching conversation members from Teams API for conversation: ${conversationId}`);
    const members = await api.conversations.members(conversationId).get();
    
    const participants = members.map((member: any) => {
      // Try different name fields that might be available
      const name = member.name || member.givenName || member.displayName || member.userPrincipalName || 'Unknown Member';
      const id = member.id || member.aadObjectId || member.userId || 'unknown';
      return { name, id };
    }).filter((participant: any) => participant.name !== 'Unknown Member');
    
    console.log(`👥 Found ${participants.length} participants from Teams API:`, participants);
    return participants;
  } catch (error) {
    console.error(`❌ Error fetching conversation members from Teams API:`, error);
    throw error;
  }
}

/**
 * Parse deadline expressions like "by tomorrow", "end of week", "by Friday" with timezone awareness
 */
function parseDeadlineWithTimezone(deadlineExpression: string, userTimezone: string = 'UTC'): string | undefined {
  if (!deadlineExpression) return undefined;
  
  console.log(`🕒 Parsing deadline "${deadlineExpression}" in timezone: ${userTimezone}`);
  
  const expression = deadlineExpression.toLowerCase().trim();
  const nowUTC = new Date();
  const nowInUserTZ = new Date(nowUTC.toLocaleString("en-US", { timeZone: userTimezone }));
  const todayInUserTZ = new Date(nowInUserTZ.getFullYear(), nowInUserTZ.getMonth(), nowInUserTZ.getDate());
  
  // Parse common deadline expressions
  if (expression.includes('tomorrow') || expression.includes('next day')) {
    const tomorrow = new Date(todayInUserTZ);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999); // End of day
    const tomorrowUTC = new Date(tomorrow.toLocaleString("en-US", { timeZone: "UTC" }));
    return tomorrowUTC.toISOString();
  }
  
  if (expression.includes('end of week') || expression.includes('this friday') || expression.includes('friday')) {
    const endOfWeek = new Date(todayInUserTZ);
    const daysUntilFriday = (5 - todayInUserTZ.getDay() + 7) % 7; // 5 = Friday
    endOfWeek.setDate(todayInUserTZ.getDate() + (daysUntilFriday || 7)); // If today is Friday, next Friday
    endOfWeek.setHours(23, 59, 59, 999);
    const endOfWeekUTC = new Date(endOfWeek.toLocaleString("en-US", { timeZone: "UTC" }));
    return endOfWeekUTC.toISOString();
  }
  
  if (expression.includes('next week') || expression.includes('monday')) {
    const nextMonday = new Date(todayInUserTZ);
    const daysUntilMonday = (8 - todayInUserTZ.getDay()) % 7; // Next Monday
    nextMonday.setDate(todayInUserTZ.getDate() + (daysUntilMonday || 7));
    nextMonday.setHours(23, 59, 59, 999);
    const nextMondayUTC = new Date(nextMonday.toLocaleString("en-US", { timeZone: "UTC" }));
    return nextMondayUTC.toISOString();
  }
  
  if (expression.includes('end of month')) {
    const endOfMonth = new Date(todayInUserTZ.getFullYear(), todayInUserTZ.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    const endOfMonthUTC = new Date(endOfMonth.toLocaleString("en-US", { timeZone: "UTC" }));
    return endOfMonthUTC.toISOString();
  }
  
  // Try to parse specific dates (this is basic - could be enhanced)
  const dateMatch = expression.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]) - 1; // JS months are 0-indexed
    const day = parseInt(dateMatch[2]);
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : todayInUserTZ.getFullYear();
    
    const specificDate = new Date(year, month, day, 23, 59, 59, 999);
    const specificDateUTC = new Date(specificDate.toLocaleString("en-US", { timeZone: "UTC" }));
    return specificDateUTC.toISOString();
  }
  
  return undefined;
}