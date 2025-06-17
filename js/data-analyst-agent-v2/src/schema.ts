import { ObjectSchema } from '@microsoft/teams.ai';

export const executeSqlSchema: ObjectSchema = {
    type: 'object',
    properties: {
        query: {
            type: 'string',
            description: 'SQL query to execute'
        }
    },
    required: ['query']
};

// Response schema for data analyst agent responses
export const responseSchema = {
    type: 'object',
    properties: {
        parseable: {
            type: 'array',
            description: 'Array of chart/table/response objects',
            items: {
                type: 'object',
                properties: {
                    shouldChart: { type: 'boolean' },
                    chartType: {
                        type: 'string',
                        enum: ['verticalBar', 'horizontalBar', 'line', 'pie', 'table'],
                        description: 'Type of chart to render, if applicable.'
                    },
                    columns: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Column names for chart/table.'
                    },
                    rows: {
                        type: 'array',
                        items: {
                            type: 'array',
                            items: {}
                        },
                        description: 'Data rows for chart/table.'
                    },
                    options: {
                        type: 'object',
                        description: 'Chart/table options such as title, axis labels, etc.',
                        properties: {
                            title: { type: 'string' },
                            xAxisTitle: { type: 'string' },
                            yAxisTitle: { type: 'string' }
                        },
                        additionalProperties: true
                    }
                },
                required: ['shouldChart'],
                additionalProperties: true
            }
        },
        text: {
            type: 'string',
            description: 'Textual response for the user.'
        }
    },
    required: ['text'],
    additionalProperties: true
};

