import { writeFileSync, readFileSync, existsSync } from "fs";
import { getClient } from "./client";
import { getConfig } from "./config";
import { getEndpointQuestions } from "./resources";
import { ChatResponse } from "./types";

const MAX_RETRIES = 2;
const RESULTS_FILE = "benchmark/results.json";
const HUMAN_RESULTS_FILE = "benchmark/results-human.json";

function readHumanResults(): ChatResponse[] {
  if (!existsSync(HUMAN_RESULTS_FILE)) {
    console.error("Human results file not found");
    return [];
  }
  try {
    return JSON.parse(readFileSync(HUMAN_RESULTS_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading human results file:", error);
    return [];
  }
}

function readExistingResults(): ChatResponse[] {
  if (!existsSync(RESULTS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(RESULTS_FILE, "utf-8"));
  } catch (error) {
    console.error("Error reading results file:", error);
    return [];
  }
}

function writeResults(results: ChatResponse[]) {
  writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function validateResults(results: ChatResponse[]): Record<string, any> {
  const humanResults = readHumanResults();
  if (humanResults.length === 0) {
    console.error("No human results available for validation");
    return {};
  }

  const humanResultsByQuestion = new Map<string, ChatResponse>();
  for (const result of humanResults) {
    humanResultsByQuestion.set(result.question.name, result);
  }

  const validation: Record<string, any> = {};

  for (const result of results) {
    if (!result.question || !result.sqlResult || result.error) {
      continue;
    }

    const questionName = result.question.name;
    const humanResult = humanResultsByQuestion.get(questionName);

    if (!humanResult || !humanResult.sqlResult) {
      continue;
    }

    if (!validation[questionName]) {
      validation[questionName] = {
        models: {},
        humanResults: humanResult.sqlResult,
      };
    }

    const modelKey = `${result.provider}/${result.model}`;
    validation[questionName].models[modelKey] = compareResults(
      humanResult.sqlResult,
      result.sqlResult
    );
  }

  writeFileSync(
    "benchmark/validation-results.json",
    JSON.stringify(validation, null, 2)
  );

  return validation;
}

function compareResults(humanResult: any, llmResult: any): any {
  if (!humanResult.data || !llmResult.data) {
    return {
      matches: false,
      reason: "Missing data in results",
    };
  }

  const humanData = humanResult.data;
  const llmData = llmResult.data;

  if (humanData.length === 0 && llmData.length === 0) {
    return {
      matches: true,
      details: "Both results are empty",
    };
  }

  if (humanData.length === 0 || llmData.length === 0) {
    return {
      matches: false,
      reason: "One result is empty while the other is not",
      humanRowCount: humanData.length,
      llmRowCount: llmData.length,
    };
  }

  if (humanData.length !== llmData.length) {
    return {
      matches: false,
      reason: "Row count mismatch",
      humanRowCount: humanData.length,
      llmRowCount: llmData.length,
    };
  }

  const humanColumns = Object.keys(humanData[0]);
  const llmColumns = Object.keys(llmData[0]);

  if (humanColumns.length !== llmColumns.length) {
    return {
      matches: false,
      reason: "Column count mismatch",
      humanColumns,
      llmColumns,
    };
  }

  const columnMapping = mapColumns(humanColumns, llmColumns);
  
  if (Object.keys(columnMapping).length !== humanColumns.length) {
    return {
      matches: false,
      reason: "Could not map all columns",
      mapping: columnMapping,
      humanColumns,
      llmColumns,
    };
  }

  const unmatchedRows = [];
  for (let i = 0; i < humanData.length; i++) {
    const humanRow = humanData[i];
    
    let foundMatch = false;
    for (let j = 0; j < llmData.length; j++) {
      const llmRow = llmData[j];
      
      let rowMatches = true;
      for (const humanCol of humanColumns) {
        const llmCol = columnMapping[humanCol];
        const humanValue = normalizeValue(humanRow[humanCol]);
        const llmValue = normalizeValue(llmRow[llmCol]);
        
        if (!valuesEqual(humanValue, llmValue)) {
          rowMatches = false;
          break;
        }
      }
      
      if (rowMatches) {
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      unmatchedRows.push({
        rowIndex: i,
        humanRow,
      });
    }
  }

  if (unmatchedRows.length > 0) {
    return {
      matches: false,
      reason: "Values mismatch",
      unmatchedRowCount: unmatchedRows.length,
      totalRows: humanData.length,
      sampleMismatches: unmatchedRows.slice(0, 3),
    };
  }

  return {
    matches: true,
    details: "All rows and values match",
    columnMapping,
  };
}

function mapColumns(humanColumns: string[], llmColumns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  for (const humanCol of humanColumns) {
    if (llmColumns.includes(humanCol)) {
      mapping[humanCol] = humanCol;
    }
  }
  
  const remainingHumanCols = humanColumns.filter(col => !mapping[col]);
  const remainingLlmCols = llmColumns.filter(col => !Object.values(mapping).includes(col));
  
  for (const humanCol of remainingHumanCols) {
    for (const llmCol of remainingLlmCols) {
      if (humanCol.toLowerCase() === llmCol.toLowerCase()) {
        mapping[humanCol] = llmCol;
        remainingLlmCols.splice(remainingLlmCols.indexOf(llmCol), 1);
        break;
      }
    }
  }
  
  const stillRemainingHumanCols = humanColumns.filter(col => !mapping[col]);
  const stillRemainingLlmCols = llmColumns.filter(col => !Object.values(mapping).includes(col));
  
  if (stillRemainingHumanCols.length === stillRemainingLlmCols.length) {
    for (let i = 0; i < stillRemainingHumanCols.length; i++) {
      mapping[stillRemainingHumanCols[i]] = stillRemainingLlmCols[i];
    }
  }
  
  return mapping;
}

function normalizeValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'number') {
    return parseFloat(value.toFixed(6));
  }
  
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }
  
  if (value instanceof Date) {
    return value.getTime();
  }
  
  return value;
}

function valuesEqual(val1: any, val2: any): boolean {
  if (val1 === null && val2 === null) {
    return true;
  }
  
  if (val1 === null || val2 === null) {
    return false;
  }
  
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    const epsilon = 0.000001;
    return Math.abs(val1 - val2) < epsilon;
  }
  
  return val1 === val2;
}

function getCompletedQuestionsForModel(
  existingResults: ChatResponse[],
  provider: string,
  model: string
): Set<string> {
  return new Set(
    existingResults
      .filter((r) => r.provider === provider && r.model === model)
      .map((r) => r.question.name)
  );
}

async function main() {
  // await runHumanQueries();
  await runBenchmark();
  
  const results = readExistingResults();
  console.log("Validating results against human baseline...");
  const validation = validateResults(results);
  console.log("Validation complete. Results saved to benchmark/validation-results.json");
}

async function runHumanQueries() {
  const client = getClient();
  const endpoints = getEndpointQuestions();

  const results = [];

  for (const endpoint of endpoints) {
    console.log(`Running ${endpoint.name}`);

    const sql = endpoint.content
      .split("SQL >")[1]
      .split("TYPE endpoint")[0]
      .trim();

    client.executeSqlQuery(sql);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await client.executeSqlQuery(sql);

    results.push({
      name: endpoint.name,
      question: {
        name: endpoint.name,
        content: endpoint.question,
      },
      sql,
      sqlResult: result,
      model: "human",
      provider: "human",
      error: null,
      attempts: [],
    });
  }

  writeFileSync(
    "benchmark/results-human.json",
    JSON.stringify(results, null, 2)
  );
}

async function runBenchmark() {
  const { providers } = getConfig();
  let existingResults = readExistingResults();

  for (const provider in providers) {
    const models = providers[provider as keyof typeof providers].models;

    let index = 0;
    for (const model of models) {
      console.log(
        `Benchmarking ${provider}/${model} (${index + 1}/${models.length})`
      );

      const completedQuestions = getCompletedQuestionsForModel(
        existingResults,
        provider,
        model
      );
      const results = await runModelBenchmark(
        provider,
        model,
        completedQuestions
      );

      existingResults = existingResults.filter(
        (r) => !(r.provider === provider && r.model === model)
      );
      existingResults.push(...results);
      writeResults(existingResults);

      index++;
    }
  }
}

async function runModelBenchmark(
  provider: string,
  model: string,
  completedQuestions: Set<string>
) {
  const client = getClient();
  const questions = getEndpointQuestions();
  const results: ChatResponse[] = [];

  async function generateQueryWithRetry(
    question: ReturnType<typeof getEndpointQuestions>[number],
    retryCount = 0,
    previousAttempts: ChatResponse[] = []
  ) {
    const result = await client.generateQuery(question, provider, model, true);

    const currentAttempts = [...previousAttempts, result];

    if (
      (result.error ||
        result.sqlResult?.success === false ||
        !!result.sqlResult?.error) &&
      retryCount < MAX_RETRIES
    ) {
      const errorFeedback = `I previously asked: "${question.question}"\n\nYou generated this SQL query:\n\`\`\`sql\n${result.sql}\n\`\`\`\n\nBut it resulted in this error:\n\`\`\`\n${result.error}\n\`\`\`\n\nPlease fix the SQL query to correctly answer my original question. Make sure the SQL is valid for Tinybird/ClickHouse.`;

      return generateQueryWithRetry(
        {
          ...question,
          question: errorFeedback,
        },
        retryCount + 1,
        currentAttempts
      );
    }

    return {
      ...result,
      question,
      model,
      provider,
      attempts: currentAttempts,
    };
  }

  // Filter out completed questions and take first 10
  const pendingQuestions = questions
    .filter(q => !completedQuestions.has(q.name))
    .slice(0, 10);
  for (const question of questions.slice(0, 10)) {
    // Skip already completed questions
    if (completedQuestions.has(question.name)) {
      console.log(`Skipping already completed question: ${question.name}`);
      continue;
    }

  // Process questions in batches of 5
  for (let i = 0; i < pendingQuestions.length; i += 5) {
    const batch = pendingQuestions.slice(i, i + 5);
    console.log(`Processing batch ${Math.floor(i/5) + 1} with ${batch.length} questions`);
    
    const batchResults = await Promise.all(
      batch.map(question => {
        console.log(`Running question: ${question.name}`);
        return generateQueryWithRetry(question);
      })
    );
    
    results.push(...batchResults);
  }

  return results;
}

main();
