/**
 * Template Capability Function Schema
 * 
 * This file defines the function schema that will be registered with the manager
 * for delegating requests to your capability.
 * 
 * Customize the schema to match your capability's input requirements.
 */

export const templateFunctionSchema = {
    type: 'object' as const,
    properties: {
        
        // TODO: Add your capability-specific parameters here
        // Examples:
        
        // For a document capability:
        // document_type: {
        //     type: 'string' as const,
        //     description: 'Type of document to work with (e.g., "report", "meeting-notes", "proposal")',
        //     enum: ['report', 'meeting-notes', 'proposal', 'other']
        // },
        // format_preference: {
        //     type: 'string' as const,
        //     description: 'Preferred output format (e.g., "markdown", "json", "plain-text")'
        // },
        
        // For a calendar capability:
        // meeting_duration: {
        //     type: 'number' as const,
        //     description: 'Preferred meeting duration in minutes'
        // },
        // include_conflicts: {
        //     type: 'boolean' as const,
        //     description: 'Whether to include conflicting time slots in the analysis'
        // },
        
        // For a data analysis capability:
        // analysis_type: {
        //     type: 'string' as const,
        //     description: 'Type of analysis to perform',
        //     enum: ['summary', 'trend', 'comparison', 'detailed']
        // },
        // include_visualizations: {
        //     type: 'boolean' as const,
        //     description: 'Whether to include charts or graphs in the response'
        // }
    },
    required: [
        // TODO: Specify which properties are required
        // Example: ['document_type'] for a document capability
        // Leave empty array if all parameters are optional
    ] as string[]
};

/**
 * Function description for the manager to understand when to delegate to your capability
 * 
 * This description helps the manager decide when to route requests to your capability.
 * Make it clear and specific about your capability's domain.
 */
export const templateFunctionDescription = 'TODO: Replace with description of when to delegate to your capability (e.g., "Handle document creation, formatting, and template management tasks", "Manage calendar operations, scheduling, and time-based queries")';

/**
 * Function name for registration with the manager
 * 
 * This should follow the pattern: delegate_to_[capability_name]
 */
export const templateFunctionName = 'delegate_to_template';

/**
 * Example schemas for common capability types:
 */

// Document Management Capability Schema
export const documentCapabilitySchema = {
    type: 'object' as const,
    properties: {
        calculated_start_time: {
            type: 'string' as const,
            description: 'Pre-calculated start time in ISO format (optional)'
        },
        calculated_end_time: {
            type: 'string' as const,
            description: 'Pre-calculated end time in ISO format (optional)'
        },
        timespan_description: {
            type: 'string' as const,
            description: 'Human-readable description of the calculated time range (optional)'
        },
        document_type: {
            type: 'string' as const,
            description: 'Type of document to work with',
            enum: ['report', 'meeting-notes', 'proposal', 'template', 'other']
        },
        format_preference: {
            type: 'string' as const,
            description: 'Preferred output format',
            enum: ['markdown', 'json', 'plain-text', 'html']
        }
    },
    required: ['document_type']
};

// Calendar Management Capability Schema
export const calendarCapabilitySchema = {
    type: 'object' as const,
    properties: {
        calculated_start_time: {
            type: 'string' as const,
            description: 'Pre-calculated start time in ISO format (optional)'
        },
        calculated_end_time: {
            type: 'string' as const,
            description: 'Pre-calculated end time in ISO format (optional)'
        },
        timespan_description: {
            type: 'string' as const,
            description: 'Human-readable description of the calculated time range (optional)'
        },
        meeting_duration: {
            type: 'number' as const,
            description: 'Preferred meeting duration in minutes'
        },
        include_conflicts: {
            type: 'boolean' as const,
            description: 'Whether to include conflicting time slots in the analysis'
        },
        participants: {
            type: 'array' as const,
            items: {
                type: 'string' as const
            },
            description: 'List of participant IDs or names for the meeting'
        }
    },
    required: []
};

// Data Analysis Capability Schema
export const dataAnalysisCapabilitySchema = {
    type: 'object' as const,
    properties: {
        calculated_start_time: {
            type: 'string' as const,
            description: 'Pre-calculated start time in ISO format (optional)'
        },
        calculated_end_time: {
            type: 'string' as const,
            description: 'Pre-calculated end time in ISO format (optional)'
        },
        timespan_description: {
            type: 'string' as const,
            description: 'Human-readable description of the calculated time range (optional)'
        },
        analysis_type: {
            type: 'string' as const,
            description: 'Type of analysis to perform',
            enum: ['summary', 'trend', 'comparison', 'detailed', 'statistical']
        },
        include_visualizations: {
            type: 'boolean' as const,
            description: 'Whether to include charts or graphs in the response'
        },
        data_sources: {
            type: 'array' as const,
            items: {
                type: 'string' as const
            },
            description: 'Specific data sources to analyze (e.g., conversation history, files, etc.)'
        }
    },
    required: ['analysis_type']
};
