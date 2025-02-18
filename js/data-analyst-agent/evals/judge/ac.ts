import { BaseAgent } from '../../src/core/base-agent';
import { createLogger } from '../../src/core/logging';

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
    const log = createLogger('ac-judge');

    const agent = new BaseAgent({
        model: 'gpt-4o-mini',
        systemMessage: [
            'You are comparing a submitted Adaptive Card to an expert answer for data visualization.',
            'Compare the content and correctness of the submitted card with the expert answer.',
            'Focus primarily on these critical aspects:',
            '1. Correct visualization type for the data (e.g. vertical bar, horizontal bar, pie chart)',
            '2. Data is properly mapped and visualized',
            '',
            'Be very lenient with differences in:',
            '- Titles, labels and text content',
            '- Exact color values (if semantically similar)',
            '- Spacing or formatting',
            '- Property ordering',
            '- Additional optional properties',
            '- Axis titles or legends',
            '',
            'As long as the correct chart type is used and the data is properly visualized,',
            'consider the submission correct even if titles and labels differ from the expert answer.',
            '',
            'The submitted answer may either be correct or incorrect. Determine which case applies.',
            'You must respond with exactly one of these two choices:',
            '- "Correct": The chart type matches and data is properly visualized',
            '- "Incorrect": Wrong chart type or data visualization issues',
            '',
            'Always provide a brief reason for your judgment.',
        ].join('\n'),
        responseSchema: {
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
        logger: log
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

            const result = await agent.chat(prompt);
            
            return {
                choice: result.choice,
                score: result.choice === 'Correct' ? 1.0 : 0.0,
                reason: result.reason
            };
        },
    };
}; 