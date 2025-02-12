import { ChatPrompt, ObjectSchema } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';
import * as fs from 'fs';
import * as path from 'path';
import { SQLExpert } from './prompts/sql-expert';
import { AdaptiveCardExpert } from './prompts/ac-expert';
import { Card } from '@teams.sdk/cards';

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

// TODO: This is a temporary type to make it work. Otherwise it should be ObjectSchema.
const responseSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
        content: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'Text message to format for the user',
                    },
                    card: {
                        type: 'object',
                        description: 'Adaptive card to format',
                        properties: {
                            type: { type: 'string', enum: ['AdaptiveCard'] },
                            version: { type: 'string', enum: ['1.5'] },
                            body: { type: 'array', items: { type: 'object' } },
                        },
                        required: ['type', 'version', 'body'],
                    },
                },
            },
            description: 'Array of content to format',
        },
    },
    required: ['content'],
};

export type DataAnalystResponse = {
    text?: string;
    card?: Card;
}[];

export const DataAnalyst = () => {
    const schemaPath = path.join(__dirname, '..', 'data', 'schema.sql');
    const dbSchema = fs.readFileSync(schemaPath, 'utf-8');
    const log = new ConsoleLogger('data-analyst', { level: 'debug' });

    const sql = SQLExpert({ log: log.child('sql-expert') });
    const card = AdaptiveCardExpert({ log: log.child('ac-expert') });

    const dataAnalyst = new ChatPrompt({
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
            "- Focus on answering the user's question directly and simply",
            '- Visualize data whenever possible using Adaptive Cards',
            '- Keep explanations brief and clear',
            '- Let the visualizations do most of the talking',
            '- Always send both the data and visualizations to Response Expert together',
            '',
            'Database Schema:',
            '```sql',
            dbSchema,
            '```',
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: log,
            requestOptions: {
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'response',
                        schema: responseSchema,
                    },
                },
            },
        }),
    })
        .function(
            'sql-expert',
            'Ask the SQL expert to help you query and analyze the database',
            chatSchema,
            async ({ text }: { text: string }) => {
                return sql.chat(text);
            },
        )
        .function(
            'ac-expert',
            'Ask the adaptive card expert to create visualizations of data.',
            chatSchema,
            async ({ text }: { text: string }) => {
                return card.chat(text);
            },
        );

    return {
        chat: async (text: string) => {
            log.info(`User Message: ${text}`);
            const response = await dataAnalyst.chat(text);
            log.info(`Data Analyst Response: ${JSON.stringify(response, null, 2)}`);
            const content: DataAnalystResponse = JSON.parse(response).content;

            return content;
        },
    };
};
