import { ChatPrompt } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';

interface ACJudgeInput {
    input: string;    // The data to visualize
    ideal: string;    // Expert answer (adaptive card JSON)
    completion: string; // Submitted answer (adaptive card JSON)
}

interface ACJudgeResult {
    score: number;
    choice: 'Correct' | 'Incorrect';
    reason?: string;
}

export const ACJudge = () => {
    const log = new ConsoleLogger('ac-judge', { level: 'debug' });

    const judge = new ChatPrompt({
        instructions: [
            'You are comparing a submitted Adaptive Card to an expert answer for data visualization.',
            'Compare the content and correctness of the submitted card with the expert answer.',
            'Focus on these aspects:',
            '1. Correct visualization type for the data',
            '2. Proper structure and required properties',
            '3. Appropriate data mapping and formatting',
            '4. Presence of essential elements (title, labels, etc.)',
            '5. Semantic equivalence of the visualizations',
            '',
            'Ignore minor differences in:',
            '- Exact color values (if semantically similar)',
            '- Spacing or formatting',
            '- Property ordering',
            '- Additional optional properties',
            '',
            'The submitted answer may either be correct or incorrect. Determine which case applies.',
            'You must respond with exactly one of these two choices:',
            '- "Correct": The cards are semantically equivalent and will display the same visualization',
            '- "Incorrect": The cards are semantically different or the submission has critical issues',
            '',
            'Always provide a brief reason for your judgment.',
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
                        name: 'response',
                        schema: {
                            type: 'object',
                            properties: {
                                choice: {
                                    type: 'string',
                                    enum: ['Correct', 'Incorrect'],
                                    description: 'The judgment of the Adaptive Card comparison',
                                },
                                reason: {
                                    type: 'string',
                                    description: 'Brief explanation for the judgment',
                                }
                            },
                            required: ['choice', 'reason'],
                        },
                    },
                },
            },
        }),
    });

    return {
        evaluate: async ({ input, ideal, completion }: ACJudgeInput): Promise<ACJudgeResult> => {
            const prompt = [
                '[BEGIN DATA]',
                '************',
                `[Data to Visualize]: ${input}`,
                '************',
                `[Expert Card]: ${ideal}`,
                '************',
                `[Submission]: ${completion}`,
                '************',
                '[END DATA]',
            ].join('\n');

            const response = await judge.chat(prompt);
            const result = JSON.parse(response);
            
            return {
                choice: result.choice,
                score: result.choice === 'Correct' ? 1.0 : 0.0,
                reason: result.reason
            };
        },
    };
}; 