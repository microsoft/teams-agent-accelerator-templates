import { ChatPrompt, Memory } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';
import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { MessageSendActivity } from '@teams.sdk/api';
import { Card } from '@teams.sdk/cards';

interface ExecuteSQLQuery {
    query: string;
}

interface CreateAdaptiveCard {
    data: string;  // JSON string of the SQL query results
    type: 'table' | 'list' | 'chart' | 'other';  // Suggested visualization type
}

export function dataAnalystPrompt(memory: Memory, send: any) {
    // Load schema from file
    const schemaPath = path.join(__dirname, '..', 'data', 'schema.sql');
    const dbSchema = fs.readFileSync(schemaPath, 'utf-8');


    const chatPrompt = new ChatPrompt({
        instructions: [
            'You are a data analyst expert that helps analyze business data.',
            'You have access to the AdventureWorks database through SQL queries.',
            '',
            'Important guidelines:',
            '- Only use SELECT queries - no mutations allowed',
            '- Break down complex analysis into steps using multiple queries',
            '- Explain your thought process and what each query does',
            '- Validate your queries before executing them',
            '- After executing a query, use create_adaptive_card to visualize the results',
            '- Choose the appropriate visualization type:',
            '  * table: for structured data with multiple columns',
            '  * list: for detailed information about few items',
            '  * chart: for numerical data that needs comparison',
            '',
            'Database Schema:',
            '```sql',
            dbSchema,
            '```'
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: new ConsoleLogger("data-analyst-prompt", { level: "debug" })
        }),
        messages: memory
    });

    // Execute SQL Query (with built-in validation)
    chatPrompt.function('execute_sql', 'Execute a SQL query and return results', {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The SQL query to execute (must be SELECT only)'
            }
        },
        required: ['query']
    }, async (params: ExecuteSQLQuery) => {
        // Query validation
        if (!params.query.trim().toLowerCase().startsWith('select')) {
            return 'Error: Only SELECT queries are allowed';
        }

        // Dangerous keywords check
        const dangerousKeywords = ['insert', 'update', 'delete', 'drop', 'alter', 'create'];
        if (dangerousKeywords.some(keyword => params.query.toLowerCase().includes(keyword))) {
            return 'Error: Query contains forbidden operations';
        }

        let db: sqlite3.Database | null = null;
        try {
            // Initialize SQLite connection
            db = initializeDatabase();
            
            const result = await new Promise<string>((resolve) => 
            {
                db!.serialize(() => {
                    db!.all(params.query, [], (err, rows) => {
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

            if (db) {
                db.close();
            }
            return `Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    });

    chatPrompt.function('create_adaptive_card', 'Create an adaptive card to visualize the data', {
        type: 'object',
        properties: {
            data: {
                type: 'string',
                description: 'JSON string of the SQL query results'
            }
        },
        required: ['data', 'type']
    }, async (params: CreateAdaptiveCard) => {
        try {
            const cardPrompt = adaptiveCardPrompt(send);
            const prompt = `Create an Adaptive Card to visualize this data as a ${params.type}:\n${params.data}. And render it as well.`;
            
            const response = await cardPrompt.chat(prompt);
            return `Adaptive card has been created, and rendered: ${response}`
        } catch (error) {
            return `Error creating adaptive card: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

    });

    function initializeDatabase() {
        try {
            const dbPath = path.join(__dirname, '..', 'data', 'adventureworks.db');
            // Enable verbose mode for debugging
            const sqlite = sqlite3.verbose();
            
            // Open database in read-only mode
            const db = new sqlite.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error('Failed to open database:', err);
                    return;
                }
                
                // Enable foreign keys after connection
                db.run('PRAGMA foreign_keys = ON');
            });

            return db;
        } catch (error) {
            throw new Error(`Failed to initialize database: ${error}`);
        }
    }

    return chatPrompt;
}

export function adaptiveCardPrompt(send: any) {
    const cardSchema = fs.readFileSync(path.join(__dirname, 'ac-schema.json'), 'utf-8');
    
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
            'Adaptive Card Schema:',
            '```json',
            cardSchema,
            '```'
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: new ConsoleLogger("adaptive-card-prompt", { level: "debug" })
        }),
    });

    // Add render_card function
    chatPrompt.function('render_card', 'Render the Adaptive Card', {
        type: 'object',
        properties: {
            card: {
                type: 'object',
                description: 'The Adaptive Card JSON to render',
                properties: {
                    type: { type: 'string', enum: ['AdaptiveCard'] },
                    version: { type: 'string', enum: ['1.5'] },
                    body: { type: 'array', items: { type: 'object' } }
                },
                required: ['type', 'version', 'body']
            }
        },
        required: ['card']
    }, async (params: { card: any }) => {
        const activity = MessageSendActivity("Here's the data:")
        .card(
          'adaptive',
          Card(params.card.body)
        )
        .build()

        await send(activity);
        

        return "Card has been rendered.";
    });


    return chatPrompt;
} 