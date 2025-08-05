// Function schemas for the summarizer

// Schema for Summarizer capability delegation function
export const SUMMARIZER_DELEGATION_SCHEMA = {
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

export const GET_RECENT_MESSAGES_SCHEMA = {
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

export const GET_MESSAGES_BY_TIME_RANGE_SCHEMA = {
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

export const SHOW_RECENT_MESSAGES_SCHEMA = {
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

export const EMPTY_SCHEMA = {
  type: 'object' as const,
  properties: {}
};
