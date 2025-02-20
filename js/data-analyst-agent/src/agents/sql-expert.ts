import { BaseAgent, JsonSchema } from '../core/base-agent';
import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { createLogger } from '../core/logging';

export type SQLExpertOptions = {
    responseFormat?: JsonSchema;
};

export const SQLExpert = ({ responseFormat }: SQLExpertOptions = {}) => {
    // Load schema from file
    const schemaPath = path.join(__dirname, '..', 'data', 'schema.sql');
    const dbSchema = fs.readFileSync(schemaPath, 'utf-8');

    const log = createLogger('sql-expert', 'DEBUG');

    const agent = new BaseAgent({
        model: 'gpt-4o-mini',
        maxLoops: 20,
        systemMessage: [
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
            '```',
        ].join('\n'),
        responseSchema: responseFormat,
        logger: log
    }).function(
        'execute_sql',
        'Execute a SQL query and return results',
        {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The SQL query to execute (must be SELECT only)"
                }
            },
            required: ["query"]
        },
        async ({ query }) => {
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
                        db!.all(query, [], (err, rows) => {
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
        }
    );

    function initializeDatabase() {
        const dbPath = path.join(__dirname, '..', 'data', 'adventureworks.db');
        const sqlite = sqlite3.verbose();
        const db = new sqlite.Database(dbPath, sqlite3.OPEN_READONLY, err => {
            if (err) {
                throw new Error('Failed to open database:', err);
            }
            db.run('PRAGMA foreign_keys = ON');
        });
        return db;
    }

    return {
        chat: async (text: string) => {
            log.info(`SQL Expert Query: ${text}`);
            const response = await agent.chat(text);
            log.info(`SQL Expert Response: ${JSON.stringify(response, null, 2)}`);
            return JSON.stringify(response);
        },
    };
};
