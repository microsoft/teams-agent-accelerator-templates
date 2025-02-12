import { ChatPrompt } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';

// Schema for the response format
const responseSchema = {
    type: 'object',
    properties: {
        card: {
            type: 'object',
            description: 'The Adaptive Card JSON to create',
            properties: {
                type: { type: 'string', enum: ['AdaptiveCard'] },
                version: { type: 'string', enum: ['1.6'] },
                body: { type: 'array', items: { type: 'object' } },
            },
            required: ['type', 'version', 'body'],
        },
    },
    required: ['card'],
};

export const adaptiveCardExpert = ({ log }: { log: ConsoleLogger }) => {
    const fullAcSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'full-ac-schema.json'), 'utf-8');
    const acSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'ac-schema.json'), 'utf-8');
    const ajv = new Ajv({ strictSchema: false });
    ajv.addSchema(JSON.parse(fullAcSchema), 'full-ac-schema');
    const validateAdaptiveCard = ajv.compile(JSON.parse(acSchema));

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
            fullAcSchema,
            '```',
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: log,
            requestOptions: {
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'adaptive_card',
                        schema: responseSchema,
                    },
                },
            },
        }),
    });

    return {
        chat: async (text: string) => {
            try {
                const max_loop = 3;
                let loop_count = 0;

                let message = text;
                while (loop_count < max_loop) {
                    log.debug(`AC Expert Loop ${loop_count + 1} of ${max_loop}`);
                    // Get response from the model
                    const response = await chatPrompt.chat(message);
                    const { card } = JSON.parse(response);

                    // Validate the card against the schema using ajv
                    const valid = validateAdaptiveCard(card);
                    if (!valid) {
                        message = `The Adaptive Card is invalid. Please fix the errors and return the updated card in JSON format. Error: ${JSON.stringify(validateAdaptiveCard.errors)}`;
                        log.debug(`Invalid card. Error message: ${message}`);
                        loop_count++;
                        continue;
                    }

                    return `Here's the adaptive card: ${response}`;
                }
            } catch (error) {
                throw Error(`Something went wrong while creating/validating the Adaptive Card. Error: ${error}`);
            }
        },
    };
};
