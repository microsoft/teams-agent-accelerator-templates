import * as fs from 'fs';
import * as path from 'path';
import { Card } from '@teams.sdk/cards';
import { createLogger } from './core/logging';
import { BaseAgent, JsonSchema } from './core/base-agent';
import { pathToSrc } from './utils';
import { ProgressUpdate } from './core/progress';
import sqlite3 from 'sqlite3';
import { responseSchema as adaptiveCardSchema } from './schemas/ac-response-schema';

const responseSchema: JsonSchema = {
    type: 'object',
    properties: {
        content: {
            type: 'array',
            description: 'Array of content to format',
            items: {
                type: 'object',
                oneOf: [
                    {
                        type: 'object',
                        properties: {
                            type: { const: 'text' },
                            text: {
                                type: 'string',
                                description: 'Text message to format for the user',
                            },
                        },
                        required: ['type', 'text'],
                    },
                    adaptiveCardSchema,
                ],
            },
        },
    },
    required: ['content'],
};

export type DataAnalystResponse = {
    text?: string;
    card?: Card;
}[];

export interface CommonAgentOptions {
    progressUpdate?: ProgressUpdate;
    customResponseSchema?: JsonSchema;
}

export const DataAnalyst = ({ progressUpdate }: CommonAgentOptions = {}) => {
    const schemaPath = path.join(pathToSrc(), 'data', 'schema.sql');
    const dbSchema = fs.readFileSync(schemaPath, 'utf-8');
    const examplesPath = path.join(pathToSrc(), 'data-analyst-examples.jsonl');
    const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf-8'));

    const log = createLogger('data-analyst', 'DEBUG');

    const agent = new BaseAgent({
        systemMessage: [
            'Section: Data Analyst Role',
            '',
            'You are an expert data analyst that helps users understand data from the AdventureWorks database.',
            'Your goal is to provide clear, visual insights by querying data and creating appropriate visualizations.',
            '',
            'Section: Database Access',
            '',
            'To query the database, use the execute_sql function with a SELECT query.',
            'Important database rules:',
            '- Only execute SELECT queries - no mutations allowed',
            '- Validate queries before execution',
            '- Use proper JOIN conditions',
            '- Return results in JSON format',
            '',
            'Database Schema:',
            '```sql',
            dbSchema,
            '```',
            '',
            'Section: Analysis Process',
            '',
            'To analyze data and create visualizations:',
            '',
            '1. Understand what data the user needs',
            '2. Query the database using execute_sql to get the data',
            '3. Only create visualizations when:',
            '   - There is meaningful data to display',
            '   - The data would benefit from visual representation',
            '   - The user specifically requests a visualization',
            '4. For simple data or single values, use text responses instead',
            '5. Package everything together and send it back to the user',
            '',
            'Section: Response Guidelines',
            '',
            'When creating responses, follow these guidelines:',
            '',
            '1. Content Structure:',
            "   - Focus on answering the user's question directly and simply",
            '   - Keep explanations brief and clear',
            '   - Use text responses for simple data or single values',
            '   - Only create visualizations when they add significant value',
            '   - Avoid creating visualizations for empty or trivial data',
            '',
            '2. Data Structure Handling:',
            '   - First consider if a text response would be sufficient',
            '   - Be extremely lenient with using Fact Sets. If the data is simple, use a text response instead.',
            '   - Only create visualizations for complex data that would benefit from it',
            '   - For different data types, use appropriate components:',
            '     * Simple values -> Text response',
            '     * Tabular data -> Table components (only if complex)',
            '     * Lists -> Container with TextBlocks (preferred for simple lists)',
            '     * Charts -> Use specific chart types (only when data warrants it):',
            '       - Horizontal bar chart -> type: Chart.HorizontalBar',
            '       - Vertical bar chart -> type: Chart.VerticalBar',
            '       - Pie chart -> type: Chart.Pie',
            '       - Line chart -> type: Chart.Line',
            '',
            '3. Visualization Guidelines:',
            '   - Only create visualizations when:',
            '     * The data is complex enough to warrant it',
            '     * The user specifically requests it',
            '     * The visualization would provide significant insight',
            '   - For simple data, prefer text responses',
            '   - When creating visualizations, choose the most appropriate type:',
            '     * horizontal bar chart',
            '     * vertical bar chart',
            '     * line chart',
            '     * pie chart',
            '     * table',
            '',
            '   - For each visualization, include:',
            '     * A clear title at the top',
            '     * For charts with axes:',
            '       - A descriptive x-axis label',
            '       - A descriptive y-axis label',
            '       - Proper x-axis format (use "date" for time-based data)',
            '',
            '   - Color Guidelines (STRICTLY use these colors only, no HEX or RGB):',
            '     * For categorical charts (horizontal bar, vertical bar, pie):',
            '       - CATEGORICALRED, CATEGORICALPURPLE, CATEGORICALLAVENDER',
            '       - CATEGORICALBLUE, CATEGORICALLIGHTBLUE, CATEGORICALTEAL',
            '       - CATEGORICALGREEN, CATEGORICALLIME, CATEGORICALMARIGOLD',
            '',
            '     * For line charts and trend data:',
            '       - SEQUENTIAL1 through SEQUENTIAL8',
            '',
            '     * For contrasting or opposing data:',
            '       - DIVERGINGBLUE, DIVERGINGLIGHTBLUE, DIVERGINGCYAN',
            '       - DIVERGINGTEAL, DIVERGINGYELLOW, DIVERGINGPEACH',
            '       - DIVERGINGLIGHTRED, DIVERGINGRED, DIVERGINGMAROON',
            '       - DIVERGINGGRAY',
            '',
            '4. Formatting and Efficiency:',
            '   - Ensure proper formatting and readability',
            '   - Support data of any size efficiently',
            '   - Return the Adaptive Card in valid JSON format',
            '   - Prefer text responses for simple data',
            '',
            '5. User Preferences:',
            '   - Honor any user preferences about visualization types and styling',
            '   - Adapt to their preferred level of detail',
            '   - Consider their specific visualization requests',
            '   - Default to text responses unless visualization is clearly beneficial',
            '',
            'Section: Examples',
            '',
            ...examples.map((example: any) =>
                [
                    '---',
                    `User: ${example.user_message}`,
                    `Assistant: ${JSON.stringify(example.data_analyst_response, null, 0)}`,
                ].join('\n'),
            ),
        ].join('\n'),
        responseSchema: responseSchema,
        logger: log,
        maxLoops: 20,
    }).function(
        'execute_sql',
        'Execute a SQL query and return results',
        {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The SQL query to execute (must be SELECT only)',
                },
            },
            required: ['query'],
        },
        async ({ query }) => {
            progressUpdate?.update('FETCHING_DATA');
            log.info(`Attempting to execute SQL query: ${query}`);

            // Query validation
            if (!query.trim().toLowerCase().startsWith('select')) {
                return 'Error: Only SELECT queries are allowed';
            }

            // Dangerous keywords check
            const dangerousKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'create'];
            if (dangerousKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
                return 'Error: Query contains forbidden operations';
            }

            let db: sqlite3.Database | null = null;
            try {
                db = initializeDatabase();
                const result = await new Promise<string>(resolve => {
                    db!.serialize(() => {
                        db!.all(query, [], (err: Error | null, rows: any[]) => {
                            if (err) {
                                resolve(`Error executing query: ${err.message}`);
                                return;
                            }
                            resolve(JSON.stringify(rows));
                        });
                    });
                });
                db.close();
                return result;
            } catch (error) {
                if (db) db.close();
                return `Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    );

    return {
        chat: async (text: string): Promise<DataAnalystResponse> => {
            progressUpdate?.update('PROCESSING_MESSAGE');
            log.info(`Data Analyst Query: ${text}`);
            const response = await agent.chat(text);
            log.info(`Data Analyst Response: ${JSON.stringify(response, null, 2)}`);
            return response.content;
        },
    };
};

function initializeDatabase() {
    const dbPath = path.join(pathToSrc(), 'data', 'adventureworks.db');
    const sqlite = sqlite3.verbose();
    const db = new sqlite.Database(dbPath, sqlite3.OPEN_READONLY, err => {
        if (err) {
            throw new Error('Failed to open database:', err);
        }
        db.run('PRAGMA foreign_keys = ON');
    });
    return db;
}
