import { ChatPrompt, ObjectSchema } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';
import * as fs from 'fs';
import * as path from 'path';
import { sqlExpert } from './prompts/sql-expert';
import { adaptiveCardExpert } from './prompts/ac-expert';
import { ActivityParams, Resource } from '@teams.sdk/api';
import { responseExpert } from './prompts/response-expert';

const chatSchema: ObjectSchema = {
    type: 'object',
    properties: {
        text: {
            type: 'string',
            description: 'what you want to ask or say to the assistant.',
        },
    },
    required: ['text'],
};

export const DataAnalyst = ({send}: { send: (activity: ActivityParams | string) => Promise<Resource> }) => {
    const schemaPath = path.join(__dirname, '..', 'data', 'schema.sql');
    const dbSchema = fs.readFileSync(schemaPath, 'utf-8');
    const log = new ConsoleLogger("data-analyst", { level: "debug" });

    const sql = sqlExpert({ log: log.child("sql-expert") });
    const card = adaptiveCardExpert({ log: log.child("ac-expert") });
    const response = responseExpert({ send, log: log.child("response-expert") });

    return new ChatPrompt({
        instructions: [
            'You are an expert data analyst that helps users understand data from the AdventureWorks database.',
            'You work with three specialized experts to create clear, visual responses:',
            '',
            '1. SQL Expert - Retrieves data through database queries',
            '2. Adaptive Card Expert - Creates visual representations of data',
            '3. Response Expert - Formats and delivers the complete response to users',
            '',
            'Your process:',
            '1. Understand what data the user needs',
            '2. Get the data through the SQL Expert',
            '3. Get visualizations of the data using the Adaptive Card Expert',
            '4. Package everything together and send to Response Expert for delivery',
            '',
            'Important guidelines:',
            '- Focus on answering the user\'s question directly and simply',
            '- Visualize data whenever possible using Adaptive Cards',
            '- Keep explanations brief and clear',
            '- Let the visualizations do most of the talking',
            '- Always send both the data and visualizations to Response Expert together',
            '',
            'Database Schema:',
            '```sql',
            dbSchema,
            '```'
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: log,
        }),
    })
    .function(
        'sql-expert',
        'Ask the SQL expert to help you query and analyze the database',
        chatSchema,
        async ({ text }: { text: string }) => {
            return sql.chat(text);
        }
    )
    .function(
        'ac-expert',
        'Ask the adaptive card expert to create visualizations of data.',
        chatSchema,
        async ({ text }: { text: string }) => {
            return card.chat(text);
        }
    )
    .function(
        'response-expert',
        'Ask the response expert to format and send responses to the user. This should include text and visualizations.',
        chatSchema,
        async ({ text }: { text: string }) => {
            return response.chat(text);
        }
    );
}