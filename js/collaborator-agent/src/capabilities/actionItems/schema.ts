// Function schemas for the action items capability

// Schema for Action Items capability delegation function
export const ACTION_ITEMS_DELEGATION_SCHEMA = {
    type: 'object' as const,
    properties: {
        calculated_start_time: {
            type: 'string' as const,
            description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
        },
        calculated_end_time: {
            type: 'string' as const,
            description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
        },
        timespan_description: {
            type: 'string' as const,
            description: 'Human-readable description of the calculated time range (optional)'
        }
    },
    required: []
};

export const ANALYZE_FOR_ACTION_ITEMS_SCHEMA = {
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

export const CREATE_ACTION_ITEM_SCHEMA = {
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

export const GET_ACTION_ITEMS_SCHEMA = {
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

export const UPDATE_ACTION_ITEM_SCHEMA = {
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

export const GET_CHAT_MEMBERS_SCHEMA = {
  type: 'object' as const,
  properties: {}
};
