import { BaseAgent } from '../core/base-agent';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../core/logging';
import { responseSchema } from '../schemas/ac-expert-schema';

export const AdaptiveCardExpert = () => {
    // const fullAcSchema = fs.readFileSync(path.join(__dirname, '..', 'schemas', 'full-ac-schema.json'), 'utf-8');
    const examplesPath = path.join(__dirname, '..', 'examples', 'ac-expert-examples.json');
    const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf-8'));

    const log = createLogger('ac-expert', 'DEBUG');

    const agent = new BaseAgent({
        maxLoops: 20,
        systemMessage: [
            'You are an expert at creating Adaptive Cards for data visualization.',
            'Your job is to analyze the data structure and create the most appropriate Adaptive Card representation.',
            '',
            'Guidelines:',
            '- Analyze the data structure and content',
            '- Choose appropriate visualization components',
            '- For tabular data, use Table components',
            '- For key-value pairs, use FactSet',
            '- For lists, use Container with TextBlocks',
            '- For charts, use the following types:',
            '  * Horizontal bar chart -> type: Chart.HorizontalBar',
            '  * Vertical bar chart -> type: Chart.VerticalBar', 
            '  * Pie chart -> type: Chart.Pie',
            '  * Line chart -> type: Chart.Line',
            '',
            'Color Guidelines:',
            '- For categorical charts (horizontal bar, vertical bar, pie), use these colors:',
            '  * CATEGORICALRED, CATEGORICALPURPLE, CATEGORICALLAVENDER',
            '  * CATEGORICALBLUE, CATEGORICALLIGHTBLUE, CATEGORICALTEAL',
            '  * CATEGORICALGREEN, CATEGORICALLIME, CATEGORICALMARIGOLD',
            '',
            '- For line charts and trend data, use sequential colors:',
            '  * SEQUENTIAL1 through SEQUENTIAL8',
            '',
            '- For showing contrasting or opposing data, use diverging colors:',
            '  * DIVERGINGBLUE, DIVERGINGLIGHTBLUE, DIVERGINGCYAN',
            '  * DIVERGINGTEAL, DIVERGINGYELLOW, DIVERGINGPEACH',
            '  * DIVERGINGLIGHTRED, DIVERGINGRED, DIVERGINGMAROON',
            '  * DIVERGINGGRAY',
            '',
            '- Ensure proper formatting and readability',
            '- Support data of any size efficiently',
            '- After creating the Adaptive Card, respond with the card in JSON format',
            // 'Adaptive Card Schema:',
            // '```json',
            // fullAcSchema,
            // '```',
            'Examples:',
            ...examples.map((example: any) => [
                '---',
                `User: ${example.user_message}`,
                `Response: ${JSON.stringify(example.adaptive_card_expert_response, null, 2)}`,
            ].join('\n')),
            '',
            'Always return a complete, valid Adaptive Card JSON object.',
        ].join('\n'),
        responseSchema: responseSchema,
        logger: log
    });

    return {
        chat: async (text: string) => {
            log.info(`AC Expert Query: ${text}`);
            const response = await agent.chat(text);
            log.info(`AC Expert Response: ${JSON.stringify(response, null, 2)}`);
            return JSON.stringify(response);
        },
    };
};