import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import fs from 'fs';
import { pathToSrc, shared } from './utils';
import { executeSqlSchema } from './schema';
import Database from 'better-sqlite3';

const schemaPath = pathToSrc('data/schema.sql');
const dbSchema = fs.readFileSync(schemaPath, 'utf-8');

const examplesPath = pathToSrc('data/data-analyst-examples.jsonl');
const examples = JSON.parse(fs.readFileSync(examplesPath, 'utf-8'));

const systemMessage = [
  'You are an expert data analyst that helps users understand data from the AdventureWorks database.',
  'Your goal is to provide clear, visual insights by querying data and creating appropriate visualizations.',
  '',
  'To query the database, use the execute_sql function with a SELECT query.',
  'Only SELECT queries are allowed. No mutations.',
  'Please provide your insights only in the "text" field of the response.',
  'You are only capable of producing horizontal bar charts, vertical bar charts, line charts, and pie charts.',
  'You can also provide text insights in the "text" field.',
  'Any time your response is purely text based (no graphs/charts), you must call the check_stream_flag function.',
  '',
  'Database Schema:',
  '```sql',
  dbSchema,
  '```',
  '',
  'Examples:',
  ...examples.map((ex: any) =>
    [
      '---',
      `User: ${ex.user_message}`,
      `Assistant: ${JSON.stringify(ex.data_analyst_response, null, 2)}`,
    ].join('\n')
  ),
  'Respond in the following JSON format ANYTIME you do not call the check_stream_flag function. Otherwise, just respond in a normal format:',
  '{',
  '  "text": "<your answer here>",',
  '  "parseable": [ ... ] // (optional, include if relevant)',
  '}',
  '',
].join('\n');

export const prompt = new ChatPrompt({
  instructions: systemMessage,
  model: new OpenAIChatModel({
    model: process.env.AOAI_MODEL!,
    apiKey: process.env.AOAI_API_KEY!,
    endpoint: process.env.AOAI_ENDPOINT!,
    apiVersion: '2025-04-01-preview'
  }),
})
  .function(
    'execute_sql',
    'Executes a SQL SELECT query and returns results',
    executeSqlSchema,
    async ({ query }) => {
      if (!query.trim().toLowerCase().startsWith('select')) {
        return 'Error: Only SELECT queries are allowed';
      }

      const forbidden = ['insert', 'update', 'delete', 'drop', 'alter', 'create'];
      if (forbidden.some(word => query.toLowerCase().includes(word))) {
        return 'Error: Query contains forbidden operations';
      }

      try {
        const dbPath = pathToSrc('data/adventureworks.db');
        const db = new Database(dbPath, { readonly: true });
        const rows = db.prepare(query).all();
        db.close();
        if (!rows.length) {
          return 'No results found for your query.';
        }
        // Only return raw data for downstream logic in index.ts
        const columns = Object.keys(rows[0] as Record<string, any>);
        const dataRows = (rows as Record<string, any>[]).map(row => columns.map(col => row[col]));
        return { columns, rows: dataRows };
      } catch (err) {
        return `Error executing query: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    }
  )
  .function(
    'check_stream_flag',
    'Sets a flag when the response should be streamed',
    {
      type: 'object',
      properties: {
        shouldStream: { type: 'boolean', description: 'Whether the response should be streamed' }
      },
      required: ['shouldStream']
    },
    async ({ shouldStream }) => {
      shared.shouldStream = true;
      console.log('check_stream_flag called with:');
      return { streamed: shouldStream };
    }
  );
