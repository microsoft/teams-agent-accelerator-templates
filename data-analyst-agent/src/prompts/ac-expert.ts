import { ChatPrompt } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';
import * as fs from 'fs';
import * as path from 'path';

export const adaptiveCardExpert = ({ log }: { log: ConsoleLogger }) => {
    const cardSchema = fs.readFileSync(path.join(__dirname, 'ac-schema.json'), 'utf-8');
    const chatPrompt = new ChatPrompt({
        instructions: [
            'You are an expert at creating Adaptive Cards for data visualization.',
            'Your job is to analyze the data structure and create the most appropriate Adaptive Card representation.',
            '',
            'Guidelines:',
            '- Analyze the data structure and content',
            '- Choose appropriate visualization components',
            '- For tabular data, use Table components',
            '- For key-value pairs, use FactSet',
            '- For lists, use Container with TextBlocks',
            '- Ensure proper formatting and readability',
            '- Support data of any size efficiently',
            '- After creating the Adaptive Card, respond with the card in JSON format',
            'Adaptive Card Schema:',
            '```json',
            cardSchema,
            '```'
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: log,
        }),
    });

    // Add render_card function
    chatPrompt.function('create_adaptive_card', 'Create an Adaptive Card to visualize the data', {
        type: 'object',
        properties: {
            card: {
                type: 'object',
                description: 'The Adaptive Card JSON to create',
                properties: {
                    type: { type: 'string', enum: ['AdaptiveCard'] },
                    version: { type: 'string', enum: ['1.6'] },
                    body: { type: 'array', items: { type: 'object' } }
                },
                required: ['type', 'version', 'body']
            }
        },
        required: ['card']
    }, async (params: { card: any }) => {
        return `Here's the adaptive card: ${JSON.stringify(params.card)}`;
    });


    return chatPrompt;
}