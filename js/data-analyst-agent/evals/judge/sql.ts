import { ChatPrompt } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';

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
    const log = new ConsoleLogger('sql-judge', { level: 'debug' });

    const judge = new ChatPrompt({
        instructions: [
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
                                    description: 'The judgment of the SQL comparison',
                                },
                                reason: {
                                    type: 'string',
                                    description: 'Explanation of why the submission was judged correct or incorrect',
                                },
                            },
                            required: ['choice', 'reason'],
                        },
                    },
                },
            },
        }),
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

            const response = await judge.chat(prompt);
            const result = JSON.parse(response);
            
            return {
                choice: result.choice,
                score: result.choice === 'Correct' ? 1.0 : 0.0,
                reason: result.reason,
            };
        },
    };
};
