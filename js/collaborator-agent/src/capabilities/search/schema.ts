// Function schemas for search operations

// Schema for Search capability delegation function
export const SEARCH_DELEGATION_SCHEMA = {
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

export const SEARCH_MESSAGES_SCHEMA = {
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
