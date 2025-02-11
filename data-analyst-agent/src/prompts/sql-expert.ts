import { ChatPrompt } from '@teams.sdk/ai';
import { OpenAIChatModel } from '@teams.sdk/openai';
import { ConsoleLogger } from '@teams.sdk/common';
import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';

interface ExecuteSQLQuery {
    query: string;
}

export const sqlExpert = ({ log }: { log: ConsoleLogger }) => {
    // Load schema from file
    const schemaPath = path.join(__dirname, '..', '..', 'data', 'schema.sql');
    const dbSchema = fs.readFileSync(schemaPath, 'utf-8');
    const chatPrompt = new ChatPrompt({
        instructions: [
            'You are a SQL expert that helps query the AdventureWorks database.',
            'You can only execute SELECT queries - no mutations allowed.',
            '',
            'Important guidelines:',
            '- Validate all queries before execution',
            '- Ensure efficient query design',
            '- Use proper JOIN conditions',
            '- Return results in JSON format',
            '- Thoroughly communicate which SQL queries were used',
            '',
            'Database Schema:',
            '```sql',
            dbSchema,
            '```'
        ].join('\n'),
        role: 'system',
        model: new OpenAIChatModel({
            model: 'gpt-4o-mini',
            apiKey: process.env.OPENAI_API_KEY,
            stream: false,
            logger: log
        }),
    });

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

    function initializeDatabase() {
        try {
            const dbPath = path.join(__dirname, '..', '..', 'data', 'adventureworks.db');
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