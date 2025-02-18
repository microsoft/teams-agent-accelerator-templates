import { BaseAgent } from '../../src/core/base-agent';
import { createLogger } from '../../src/core/logging';

interface SQLJudgeInput {
    input: string;    // The question
    ideal: string;    // Expert answer
    completion: string; // Submitted answer
}

interface SQLJudgeResult {
    score: number;
    choice: 'Correct' | 'Incorrect';
    reason?: string;
}

export const SQLJudge = () => {
    const log = createLogger('sql-judge');

    const agent = new BaseAgent({
        model: 'gpt-4o-mini',
        systemMessage: [
            'You are comparing a submitted answer to an expert answer on a given SQL coding question.',
            'Compare the content and correctness of the submitted SQL with the expert answer.',
            'Ignore any differences in whitespace, style, or output column names.',
            '',
            'Guidelines:',
            '- Two SQL queries that return the same data are considered semantically equivalent,', 
            '  even if one includes an ORDER BY clause and the other does not',
            '- Only consider ORDER BY differences as meaningful when the user query explicitly',
            '  requires or asks for results in a specific order',
            '',
            'The submitted answer may either be correct or incorrect. Determine which case applies.',
            'You must respond with exactly one of these two choices:',
            '- "Correct": The submitted SQL and expert answer are semantically the same (yield same results)',
            '- "Incorrect": The submitted SQL and expert answer are semantically different or will error',
        ].join('\n'),
        responseSchema: {
            type: 'object',
            properties: {
                choice: {
                    type: 'string',
                    enum: ['Correct', 'Incorrect'],
                    description: 'The judgment of the SQL comparison',
                },
                reason: {
                    type: 'string',
                    description: 'Explanation of why the submission was judged correct or incorrect',
                },
            },
            required: ['choice', 'reason'],
        },
        logger: log
    });

    return {
        evaluate: async ({ input, ideal, completion }: SQLJudgeInput): Promise<SQLJudgeResult> => {
            const prompt = [
                '[BEGIN DATA]',
                '************',
                `[Question]: ${input}`,
                '************',
                `[Expert]: ${ideal}`,
                '************',
                `[Submission]: ${completion}`,
                '************',
                '[END DATA]',
            ].join('\n');

            const result = await agent.chat(prompt);
            
            return {
                choice: result.choice,
                score: result.choice === 'Correct' ? 1.0 : 0.0,
                reason: result.reason,
            };
        },
    };
};
