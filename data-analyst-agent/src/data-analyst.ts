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

const acExpertSchema: ObjectSchema = {
    type: 'object',
    properties: {
        instructions: {
            type: 'string',
            description: 'instructions for the adaptive card expert',
        },
        visualization: {
            type: 'string',
            description: 'The type of visualization to create',
            enum: ['horizontal bar chart', 'vertical bar chart', 'line chart', 'pie chart', 'table'],
        },
        title: {
            type: 'string',
            description: 'The title for the visualization',
        },
        xAxis: {
            type: 'string',
            description: 'Label for the x-axis (for charts)',
        },
        yAxis: {
            type: 'string',
            description: 'Label for the y-axis (for charts)',
        }
    },
    required: ['instructions', 'visualization'],
};

// TODO: This is a temporary type to make it work. Otherwise it should be ObjectSchema.
const responseSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
        content: {
            type: 'array',
            items: {
                anyOf: [
                    {
                        type: 'object',
                        properties: {
                            text: {
                                type: 'string',
                                description: 'Text message to format for the user',
                            }
                        },
                        required: ['text']
                    },
                    {
                        type: 'object', 
                        properties: {
                            card: {
                                type: 'object',
                                description: 'Adaptive card to format',
                                properties: {
                                    type: { type: 'string', enum: ['AdaptiveCard'] },
                                    version: { type: 'string', enum: ['1.5'] },
                                    body: { type: 'array', items: { type: 'object' } },
                                },
                                required: ['type', 'version', 'body'],
                            }
                        },
                        required: ['card']
                    }
                ],
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
    const examplesPath = path.join(__dirname, 'data-analyst-examples.jsonl');
    const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf-8'));

    const log = new ConsoleLogger('data-analyst', { level: 'info' });

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
            '3. Choose appropriate visualization types and create them through the Adaptive Card Expert:',
            '   - Use bar charts for comparing categories',
            '   - Use line charts for trends over time',
            '   - Use pie charts for showing proportions of a whole',
            '   - Use tables for detailed numeric data',
            '   - Consider vertical bars for many categories',
            '   - Use fact sets for simple lists or key-value pairs',
            '   - Always check if user specified a preferred visualization type:',
            '     * If they request a specific chart type, use that even if not optimal',
            '     * If they mention wanting to "see" or "visualize" something specific, adapt to that',
            '     * If they ask for a "breakdown" or "comparison", default to appropriate chart type',
            '   - Honor any user preferences about:',
            '     * Colors and styling',
            '     * How data should be grouped or arranged', 
            '     * Specific metrics or categories to highlight',
            '     * Level of detail (summary vs detailed)',
            '4. Package everything together and send to Response Expert for delivery',
            '',
            'Important guidelines:',
            "- Focus on answering the user's question directly and simply",
            '- Always specify visualization type when requesting charts',
            '- Provide clear titles and axis labels for all charts',
            '- Choose visualizations that best represent the data:',
            '  * Bar charts: Category comparisons (e.g., sales by product)',
            '  * Line charts: Time series data (e.g., monthly trends)',
            '  * Pie charts: Part-to-whole relationships (max 6-7 segments)',
            '  * Tables: Detailed numeric data or multiple metrics',
            '- Keep explanations brief and clear',
            '- Let the visualizations do most of the talking',
            '- Always send both the data and visualizations to Response Expert together',
            '- Simply return the adaptive card generated by the Adaptive Card Expert, do not tamper with it.',
            '',
            'Examples:',
            ...examples.map((example: any) => [
                '---',
                `User: ${example.user_message}`,
                `Assistant: ${example.data_analyst_response}`,
            ].join('\n')),
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
                log.info(`SQL Expert Query: ${text}`);
                const response = await sql.chat(text);
                log.info(`SQL Expert Response: ${response}`);
                return response;
            },
        )
        .function(
            'ac-expert',
            'Ask the adaptive card expert to create visualizations of data.',
            acExpertSchema,
            async ({ instructions, visualization, title, xAxis, yAxis }: { instructions: string; visualization: string; title?: string; xAxis?: string; yAxis?: string }) => {
                let message = `Please create a ${visualization} visualization with the following instructions: ${instructions}.`;
                if (title) {
                    message += ` Use "${title}" as the chart title.`;
                }
                if (xAxis) {
                    message += ` Label the x-axis as "${xAxis}".`;
                }
                if (yAxis) {
                    message += ` Label the y-axis as "${yAxis}".`;
                }
                log.info(`Adaptive Card Expert Message: ${message}`);
                const response = await card.chat(message);
                log.info(`Adaptive Card Expert Response: ${response}`);
                return response;
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
