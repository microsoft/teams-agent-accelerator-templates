import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';

interface ACJudgeInput {
    input: string; // The data to visualize
    ideal: string; // Expert answer (adaptive card JSON)
    completion: string; // Submitted answer (adaptive card JSON)
}

interface ACJudgeResult {
    score: number;
    choice: 'Correct' | 'Incorrect';
    reason?: string;
}

export const ACJudge = () => {
    const systemMessage = [
        'You are comparing a submitted Adaptive Card to an expert answer for data visualization.',
        'Compare the content and correctness of the submitted card with the expert answer.',
        'Focus primarily on these critical aspects:',
        '1. Correct visualization type for the data (e.g. vertical bar, horizontal bar, pie chart)',
        '2. Data is properly mapped and visualized',
        '',
        'Be extremely lenient with differences in. Discrepancies involving this should NOT be considered incorrect.',
        '- Titles, labels and text content',
        '- Spacing or formatting',
        '- Property ordering',
        '- Additional optional properties',
        '- Axis titles or legends',
        '',
        'Special Instructions:',
        '- Color values do not have to be the same as input colors.',
        '- Color values have to be one of the following:',
        '  * CATEGORICALRED, CATEGORICALPURPLE, CATEGORICALLAVENDER,',
        '    CATEGORICALBLUE, CATEGORICALLIGHTBLUE, CATEGORICALTEAL,',
        '    CATEGORICALGREEN, CATEGORICALLIME, CATEGORICALMARIGOLD',
        '  * SEQUENTIAL1 through SEQUENTIAL8',
        '  * DIVERGINGBLUE, DIVERGINGLIGHTBLUE, DIVERGINGCYAN,',
        '    DIVERGINGTEAL, DIVERGINGYELLOW, DIVERGINGPEACH,',
        '    DIVERGINGLIGHTRED, DIVERGINGRED, DIVERGINGMAROON,',
        '    DIVERGINGGRAY',
        '',
        'As long as the correct chart type is used and the data is properly visualized,',
        'consider the submission correct even if titles, labels, colors, or other properties differ from the expert answer.',
        '',
        'The submitted answer may either be correct or incorrect. Determine which case applies.',
        'You must respond with exactly one of these two choices:',
        '- "Correct": The chart type matches and data is properly visualized',
        '- "Incorrect": Wrong chart type or data visualization issues',
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
        evaluate: async ({ input, ideal, completion }: ACJudgeInput): Promise<ACJudgeResult> => {
            const userPrompt = [
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
