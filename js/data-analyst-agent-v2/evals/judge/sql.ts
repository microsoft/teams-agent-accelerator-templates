import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';

interface SQLJudgeInput {
    input: string; // The question
    ideal: string; // Expert answer
    completion: string; // Submitted answer
}

interface SQLJudgeResult {
    score: number;
    choice: 'Correct' | 'Incorrect';
    reason?: string;
}

export const SQLJudge = () => {
    const systemMessage = [
        'You are comparing a submitted answer to an expert answer on a given SQL coding question.',
        'Compare the content and correctness of the submitted SQL with the expert answer.',
        'Ignore any differences in whitespace, style, or output column names.',
        '',
        'Guidelines:',
        '- Two SQL queries that return the same data are considered semantically equivalent,',
        '  even if one includes an ORDER BY clause and the other does not. This means small differences in logic can still be considered correct.',
        '- Only consider ORDER BY differences as meaningful when the user query explicitly',
        '  requires or asks for results in a specific order',
        ' - If there is ambiguity in the user query, use best judgement to determine the correct answer',
        '',
        'The submitted answer may either be correct or incorrect. Determine which case applies.',
        'You must respond with exactly one of these two choices:',
        '- "Correct": The submitted SQL and expert answer are semantically the same (yield same results)',
        '- "Incorrect": The submitted SQL and expert answer are semantically different or will error',
        '',
        'Always provide a brief reason for your judgment and surround your initial choice with quotes.',
    ].join('\n');
    const prompt = new ChatPrompt({
        instructions: systemMessage,
        model: new OpenAIChatModel({
            model: process.env.AOAI_MODEL!,
            apiKey: process.env.AOAI_API_KEY!,
            endpoint: process.env.AOAI_ENDPOINT!,
            apiVersion: '2025-04-01-preview',
        }),
    });
    return {
        evaluate: async ({ input, ideal, completion }: SQLJudgeInput): Promise<SQLJudgeResult> => {
            const userPrompt = [
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
            const res = await prompt.send(userPrompt);
            // Instead of JSON parsing, extract the first quoted word ("Correct" or "Incorrect")
            let content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
            const match = content.match(/"(Correct|Incorrect)"/i);
            let choice: 'Correct' | 'Incorrect' = 'Incorrect';
            if (match && match[1]) {
                choice = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() as 'Correct' | 'Incorrect';
            }
            // Extract a reason (first line after the quoted word, or the rest of the string)
            let reason = '';
            const reasonMatch = content.split(match ? match[0] : '')[1];
            if (reasonMatch) {
                reason = reasonMatch.replace(/^[^a-zA-Z0-9]+/, '').split(/[\n\r]/)[0];
            } else {
                reason = content;
            }
            return {
                choice,
                score: choice === 'Correct' ? 1.0 : 0.0,
                reason: reason.trim(),
            };
        },
    };
};
