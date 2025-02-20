import { ConsoleLogger } from '@teams.sdk/common';
import { SQLExpert } from '../../src/agents/sql-expert';
import { SQLJudge } from '../judge/sql';
import * as fs from 'fs';
import * as path from 'path';

interface EvalCase {
  task: string;
  user_query: string;
  sql_query: string;  // The expert/ideal SQL query
}

interface EvalResult {
  task: string;
  user_query: string;
  expected_sql: string;
  actual_sql?: string;
  success: boolean;
  judge_result: {
    choice: 'Correct' | 'Incorrect';
    score: number;
    reason?: string;
  };
  error?: string;
}

async function evaluateSqlExpert() {
  const log = new ConsoleLogger('sql-expert-eval', { level: 'info' });
  const judge = SQLJudge();

  // Load test cases
  const evalFilePath = path.join(__dirname, '..', 'sql-eval.jsonl');
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
      const expert = SQLExpert({ responseFormat: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The SQL query to execute',
          }
        },
        required: ['query'],
        additionalProperties: false
      }});
      const response = await expert.chat(
        `Here's the user query: ${testCase.user_query}. 
        Can you simply generate the SQL query to answer the question? Please don't execute it. 
        Just return the SQL query.`
      );
      const parsedResponse = JSON.parse(response);
      // Get judgment from SQL judge
      const judgeResult = await judge.evaluate({
        input: testCase.user_query,
        ideal: testCase.sql_query,
        completion: parsedResponse.query
      });

      results.push({
        task: testCase.task,
        user_query: testCase.user_query,
        expected_sql: testCase.sql_query,
        actual_sql: parsedResponse.query,
        success: judgeResult.choice === 'Correct',
        judge_result: {
          choice: judgeResult.choice,
          score: judgeResult.score,
          reason: judgeResult.reason
        }
      });

    } catch (error) {
      console.log(`Error while evaluating: ${error}`);
      results.push({
        task: testCase.task,
        user_query: testCase.user_query,
        expected_sql: testCase.sql_query,
        success: false,
        judge_result: {
          choice: 'Incorrect',
          score: 0,
          reason: error instanceof Error ? error.message : 'Unknown error'
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Output results
  outputResults(results);
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
    console.log(`Expected SQL: ${result.expected_sql}`);
    console.log(`Actual SQL: ${result.actual_sql || 'N/A'}`);
    console.log(`Judge Result: ${result.judge_result.choice} (Score: ${result.judge_result.score})`);
    if (result.judge_result.reason) {
      console.log(`Judge Reasoning: ${result.judge_result.reason}`);
    }
    
    if (!result.success && result.error) {
      console.log('\nError:', result.error);
    }
  });
}

// Run evaluation
evaluateSqlExpert().catch(error => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
