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

