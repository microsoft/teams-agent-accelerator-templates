import { ChatPrompt, ObjectSchema } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';
import { ActivityParams, cardAttachment, Resource } from '@teams.sdk/api';
import { Card } from '@teams.sdk/cards';

interface FormattedContent {
    text?: string;
    card?: Card;
}

const formatSchema: ObjectSchema = {
    type: 'object',
    properties: {
        content: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'Text message to format for the user'
                    },
                    card: {
                        type: 'object',
                        description: 'Adaptive card to format',
                        properties: {
                            type: { type: 'string', enum: ['AdaptiveCard'] },
                            version: { type: 'string', enum: ['1.5'] },
                            body: { type: 'array', items: { type: 'object' } }
                        },
                        required: ['type', 'version', 'body']
                    }
                }
            },
            description: 'Array of content to format'
        }
    },
    required: ['content']
};

export const responseExpert = ({ 
    send,
    log 
}: { 
    send: (activity: ActivityParams | string) => Promise<Resource>;
    log: ConsoleLogger;
}) => {
    const chatPrompt = new ChatPrompt({
        instructions: [
            'You are an expert at formatting responses.',
            'Your job is to take content and ensure it is properly formatted before sending.',
            '',
            'Guidelines:',
            '- Preserve the original content and meaning',
            '- Ensure consistent formatting',
            '- Do not modify or add to the information',
            '- Do not restructure or rewrite the content',
            '- Focus only on proper formatting and presentation'
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: log
        }),
    });

    chatPrompt.function('format_content', 'Format the content while preserving its original information', 
        formatSchema,
        async ({ content }: { content: FormattedContent[] }) => {
            for (const item of content) {
                if (item.text) {
                    await send({
                        type: 'message',
                        text: item.text
                    });
                }
                
                if (item.card) {
                    const card = cardAttachment("adaptive", item.card);
                    await send({
                        type: 'message',
                        attachments: [card]
                    });
                }
            }
            return "Content formatted and sent";
        }
    );

    return chatPrompt;
} 