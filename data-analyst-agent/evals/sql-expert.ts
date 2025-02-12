import { ConsoleLogger } from '@teams.sdk/common';
import { SQLExpert } from '../src/prompts/sql-expert';
import * as fs from 'fs';
import * as path from 'path';

interface EvalCase {
  task: string;
  user_query: string;
  sql_query: string;
  result: unknown[];
}

interface EvalResult {
  task: string;
  user_query: string;
  sql_query: string;
  expected_result: unknown[];
  actual_sql_query?: string;
  actual_result: unknown[] | null;
  success: boolean;
  error?: string;
}

async function evaluateSqlExpert() {
  const log = new ConsoleLogger('sql-expert-eval', { level: 'debug' });

  // Load test cases
  const evalFilePath = path.join(__dirname, 'sql-eval.jsonl');
  const evalContent = fs.readFileSync(evalFilePath, 'utf-8');
  const evalCases: EvalCase[] = JSON.parse(evalContent);

  // Check if run-one flag is passed
  const runOne = process.argv.includes('--run-one');
  const casesToRun = runOne ? evalCases.slice(1, 2) : evalCases;
  const results: EvalResult[] = [];

  // Run each test case
  for (const testCase of casesToRun) {
    log.info(`Evaluating: ${testCase.task}`);
    
    try {
      // Get response from SQL expert
      const expert = SQLExpert({ log: log.child('sql-expert'), responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          schema: {
            type: 'object',
            properties: {
              result: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true
                }
              },
              query: {
                type: 'string',
                description: 'The SQL query that was executed',
              }
            },
            required: ['result', 'query']
          }
        },
      } });
      const response = await expert.chat(`${testCase.user_query}`);
      
      // Parse the response directly as an array
      let parsedResponse = JSON.parse(response);

      // Compare results
      const success = compareResults(testCase.result, parsedResponse.result);

      results.push({
        task: testCase.task,
        user_query: testCase.user_query,
        sql_query: testCase.sql_query,
        expected_result: testCase.result,
        actual_result: parsedResponse.result,
        actual_sql_query: parsedResponse.query,
        success
      });

    } catch (error) {
      results.push({
        task: testCase.task,
        user_query: testCase.user_query,
        sql_query: testCase.sql_query,
        expected_result: testCase.result,
        actual_result: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Output results
  outputResults(results);
}

function compareResults(expected: unknown[], actual: unknown[] | null): boolean {
  if (!actual) return false;
  
  // Simple equality check for now
  // Could be enhanced with more sophisticated comparison logic
  return JSON.stringify(expected) === JSON.stringify(actual);
}

function outputResults(results: EvalResult[]) {
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;

  console.log('\n=== SQL Expert Evaluation Results ===\n');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success Rate: ${((successfulTests / totalTests) * 100).toFixed(2)}%\n`);

  // Output detailed results
  results.forEach((result, index) => {
    console.log(`\n--- Test Case ${index + 1}: ${result.task} ---`);
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`User Query: ${result.user_query}`);
    console.log(`Expected SQL: ${result.sql_query}`);
    console.log(`Actual SQL: ${result.actual_sql_query || 'N/A'}`);
    
    if (!result.success) {
      if (result.error) {
        console.log('\nError:', result.error);
      } else {
        console.log('\nResults Comparison:');
        console.log('Expected:', JSON.stringify(result.expected_result, null, 2));
        console.log('Actual:', JSON.stringify(result.actual_result, null, 2));
      }
    }
  });
}

// Run evaluation
evaluateSqlExpert().catch(error => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
