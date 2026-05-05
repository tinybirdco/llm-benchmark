import { writeFileSync, readFileSync, existsSync } from "fs";
import { getClient } from "./client";
import { getConfig } from "./config";
import { getEndpointQuestions } from "./resources";
import { ChatResponse, SqlResult } from "./types";
import { compareResults } from "./result-validator";

const MAX_RETRIES = 2;
const RESULTS_FILE = "benchmark/results.json";
const HUMAN_RESULTS_FILE = "benchmark/results-human.json";

// Debug logging function that only logs when LLM_DEBUG=1
function debugLog(message: string, data?: Record<string, unknown>): void {
  if (process.env.LLM_DEBUG === '1') {
    console.log(`[DEBUG] ${message}`);
    if (data !== undefined) {
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(data);
      }
    }
    console.log('-----------------------------------');
  }
}

// Function to print usage information
function printUsage(): void {
  console.log(`
Tinybird LLM Benchmark Tool

Usage:
  npm run benchmark [options]

Options:
  --model=<provider/model>   Run benchmark for a specific model (e.g., --model=x-ai/grok-3-beta)
  --skip-validation          Skip validating results against human baseline
  --debug                    Enable debug mode to log LLM requests and responses
  --help                     Display this help message

Examples:
  npm run benchmark
  npm run benchmark -- --model=x-ai/grok-3-beta
  npm run benchmark -- --model=x-ai/grok-3-beta --debug
  npm run benchmark -- --skip-validation
  `);
}

// Parse command line arguments
function parseArgs(): { model?: string; skipValidation?: boolean; debug?: boolean; help?: boolean } {
  const args: { model?: string; skipValidation?: boolean; debug?: boolean; help?: boolean } = {};
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--model=')) {
      args.model = arg.substring('--model='.length);
    } else if (arg === '--model' && i + 1 < process.argv.length) {
      args.model = process.argv[i + 1];
      i++; // Skip the next argument as we've already processed it
    } else if (arg === '--skip-validation') {
      args.skipValidation = true;
    } else if (arg === '--debug') {
      args.debug = true;
    } else if (arg === '--help') {
      args.help = true;
    }
  }
  
  return args;
}

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

function extractDescription(content: string | undefined): string {
  if (!content) return "";
  const match = content.match(/DESCRIPTION\s*>\s*\n([\s\S]*?)(?=\nNODE|\nSQL|\nTYPE|$)/);
  if (!match) return content.substring(0, 200);
  return match[1].trim().replace(/\s+/g, " ");
}

async function pushToTinybird(results: ChatResponse[]) {
  const { tinybird } = getConfig();
  if (!tinybird.workspaceToken) return;

  const ndjson = results.map((r) => {
    const isHuman = r.model === "human" && r.provider === "human";
    const numAttempts = r.attempts?.length ?? 1;
    const firstAttemptSuccess =
      isHuman
        ? 1
        : numAttempts === 1 && r.sqlResult?.success
          ? 1
          : 0;

    return JSON.stringify({
      sql: r.sql ?? "",
      sql_result_success: r.sqlResult?.success ? 1 : 0,
      sql_result_execution_time: r.sqlResult?.executionTime ?? 0,
      sql_result_error: (r.sqlResult?.error ?? "").substring(0, 500),
      sql_result_query_latency: r.sqlResult?.statistics?.elapsed ?? null,
      sql_result_rows_read: r.sqlResult?.statistics?.rows_read ?? null,
      sql_result_bytes_read: r.sqlResult?.statistics?.bytes_read ?? null,
      name: r.name,
      question: extractDescription(r.question?.content) || r.question?.question || "",
      model: r.model,
      provider: r.provider,
      llm_time_to_first_token: r.metrics?.timeToFirstToken ?? 0,
      llm_total_duration: r.metrics?.totalDuration ?? 0,
      llm_prompt_tokens: r.metrics?.tokens?.promptTokens ?? 0,
      llm_completion_tokens: r.metrics?.tokens?.completionTokens ?? 0,
      llm_total_tokens: r.metrics?.tokens?.totalTokens ?? 0,
      llm_error: r.error ?? "",
      num_attempts: numAttempts,
      first_attempt_success: firstAttemptSuccess,
    });
  }).join("\n");

  try {
    const res = await fetch(`${tinybird.apiHost}/v0/events?name=benchmark_results`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tinybird.workspaceToken}` },
      body: ndjson,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to push results to Tinybird (${res.status}): ${text}`);
      return;
    }

    const json = await res.json();
    console.log(`Pushed ${json.successful_rows} results to Tinybird`);
  } catch (err) {
    console.error("Failed to push results to Tinybird:", err);
  }
}

async function pushValidationToTinybird(validation: Record<string, ValidationResult | ValidationSummary>) {
  const { tinybird } = getConfig();
  if (!tinybird.workspaceToken) return;

  const rows: string[] = [];
  for (const [questionName, questionData] of Object.entries(validation)) {
    if (questionName === '_summary') continue;
    const vr = questionData as ValidationResult;
    for (const [modelKey, modelResult] of Object.entries(vr.models)) {
      const [provider, ...modelParts] = modelKey.split('/');
      const model = modelParts.join('/');
      rows.push(JSON.stringify({
        model,
        provider,
        name: questionName,
        matches: modelResult.matches ? 1 : 0,
        exact_matches: modelResult.exactMatches ? 1 : 0,
        numeric_matches: modelResult.numericMatches ? 1 : 0,
        distance_exact: modelResult.distance?.exact ?? 1,
        distance_numeric: modelResult.distance?.numeric ?? 1,
        distance_fscore: modelResult.distance?.fScore ?? 0,
        human_row_count: (modelResult as any).humanRowCount ?? 0,
        llm_row_count: (modelResult as any).llmRowCount ?? 0,
      }));
    }
  }

  if (rows.length === 0) return;

  try {
    const res = await fetch(`${tinybird.apiHost}/v0/events?name=benchmark_validation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tinybird.workspaceToken}` },
      body: rows.join("\n"),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to push validation to Tinybird (${res.status}): ${text}`);
      return;
    }

    const json = await res.json();
    console.log(`Pushed ${json.successful_rows} validation results to Tinybird`);
  } catch (err) {
    console.error("Failed to push validation to Tinybird:", err);
  }
}

interface ValidationResult {
  models: Record<string, ModelValidationResult>;
  humanResults: SqlResult;
}

interface ModelValidationResult {
  matches: boolean;
  exactMatches: boolean;
  numericMatches: boolean;
  distance?: {
    exact: number;
    numeric: number;
    fScore: number;
  };
  sql: string;
}

interface ValidationSummary {
  totalQuestions: number;
  modelStats: Record<
    string,
    {
      totalMatches: number;
      exactMatches: number;
      numericMatches: number;
      avgExactDistance: number;
      avgNumericDistance: number;
      avgFScore: number;
    }
  >;
}

async function validateResults(results: ChatResponse[]): Promise<Record<string, ValidationResult | ValidationSummary>> {
  const humanResults = readHumanResults();
  if (humanResults.length === 0) {
    console.error("No human results available for validation");
    return {};
  }

  const humanResultsByQuestion = new Map<string, ChatResponse>();
  for (const result of humanResults) {
    humanResultsByQuestion.set(result.question.name, result);
  }

  const validation: Record<string, ValidationResult | ValidationSummary> = {};

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
      } as ValidationResult;
    }

    const modelKey = `${result.provider}/${result.model}`;
    const comparisonResult = compareResults(
      humanResult.sqlResult,
      result.sqlResult
    );

    const validationResult = validation[questionName] as ValidationResult;
    validationResult.models[modelKey] = {
      ...comparisonResult,
      sql: result.sql as string,
    };
  }

  const summary = calculateValidationSummary(validation);
  validation._summary = summary;

  await pushValidationToTinybird(validation);

  return validation;
}

function calculateValidationSummary(validation: Record<string, ValidationResult | ValidationSummary>): ValidationSummary {
  const summary: ValidationSummary = {
    totalQuestions: 0,
    modelStats: {} as Record<
      string,
      {
        totalMatches: number;
        exactMatches: number;
        numericMatches: number;
        avgExactDistance: number;
        avgNumericDistance: number;
        avgFScore: number;
      }
    >,
  };

  const questions = Object.keys(validation).filter((key) => key !== "_summary");
  summary.totalQuestions = questions.length;

  for (const questionName of questions) {
    const questionData = validation[questionName] as ValidationResult;
    const models = questionData.models;

    for (const modelKey of Object.keys(models)) {
      if (!summary.modelStats[modelKey]) {
        summary.modelStats[modelKey] = {
          totalMatches: 0,
          exactMatches: 0,
          numericMatches: 0,
          avgExactDistance: 0,
          avgNumericDistance: 0,
          avgFScore: 0,
        };
      }

      const modelResult = models[modelKey];
      const stats = summary.modelStats[modelKey];

      if (modelResult.matches) {
        stats.totalMatches++;
      }

      if (modelResult.exactMatches) {
        stats.exactMatches++;
      }

      if (modelResult.numericMatches) {
        stats.numericMatches++;
      }

      if (modelResult.distance) {
        stats.avgExactDistance += modelResult.distance.exact || 0;
        stats.avgNumericDistance += modelResult.distance.numeric || 0;
        stats.avgFScore += modelResult.distance.fScore || 0;
      }
    }
  }

  for (const modelKey of Object.keys(summary.modelStats)) {
    const stats = summary.modelStats[modelKey];
    let questionsWithData = 0;
    for (const q of questions) {
      const qData = validation[q] as ValidationResult;
      if (qData.models[modelKey]) questionsWithData++;
    }
    const count = questionsWithData || 1;
    stats.avgExactDistance = stats.avgExactDistance / count;
    stats.avgNumericDistance = stats.avgNumericDistance / count;
    stats.avgFScore = stats.avgFScore / count;
  }

  return summary;
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
  const args = parseArgs();
  
  // Show help if requested
  if (args.help) {
    printUsage();
    return;
  }
  
  // Set debug mode if flag is provided
  if (args.debug) {
    process.env.LLM_DEBUG = '1';
    console.log('Debug mode enabled. LLM requests and responses will be logged.');
  }
  
  if (args.model) {
    console.log(`Running benchmark for specific model: ${args.model}`);
    await runBenchmarkForModel(args.model);
  } else {
    //await runHumanQueries();
    await runBenchmark();
  }

  if (!args.skipValidation) {
    const results = readExistingResults();
    console.log("Validating results against human baseline...");

    await validateResults(results);
    console.log("Validation complete. Results pushed to Tinybird.");
  } else {
    console.log("Skipping validation as requested");
  }
}

// Export the function to avoid 'defined but never used' error
export async function runHumanQueries() {
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

async function runBenchmarkForModel(modelString: string) {
  const [providerName, modelName] = modelString.split('/');
  
  if (!providerName || !modelName) {
    console.error("Invalid model format. Please use format: --model=provider/model");
    process.exit(1);
  }
  
  console.log(`Benchmarking ${providerName}/${modelName}`);
  
  // Read the current config file
  const configPath = "benchmark-config.json";
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (error) {
    console.error("Error reading benchmark-config.json:", error);
    process.exit(1);
  }
  
  // Check if the provider exists in the config, create it if it doesn't
  if (!config.providers[providerName]) {
    console.log(`Provider '${providerName}' not found in benchmark-config.json, creating new entry`);
    config.providers[providerName] = { models: [] };
    
    // Write the updated config back to disk
    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`Added provider '${providerName}' to benchmark-config.json`);
    } catch (error) {
      console.error("Error writing updated benchmark-config.json:", error);
      process.exit(1);
    }
  }
  
  // Check if the model already exists for the provider
  const providerModels = config.providers[providerName].models;
  if (providerModels.includes(modelName)) {
    console.log(`Model '${modelName}' already exists for provider '${providerName}'`);
  } else {
    // Add the model to the provider's model list
    config.providers[providerName].models.push(modelName);
    
    // Write the updated config back to disk
    try {
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`Added model '${modelName}' to provider '${providerName}' in benchmark-config.json`);
    } catch (error) {
      console.error("Error writing updated benchmark-config.json:", error);
      process.exit(1);
    }
  }
  
  const existingResults = readExistingResults();
  const completedQuestions = getCompletedQuestionsForModel(
    existingResults,
    providerName,
    modelName
  );
  
  const results = await runModelBenchmark(
    providerName,
    modelName,
    completedQuestions
  );
  
  // Remove existing results for this model and upsert with new results
  const filteredResults = existingResults.filter(
    r => !(r.provider === providerName && r.model === modelName)
  );

  const updatedResults = [...filteredResults, ...results];
  writeResults(updatedResults);
  await pushToTinybird(results);
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
      await pushToTinybird(results);

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
    previousAttempts: ChatResponse[] = [],
    originalQuestion?: ReturnType<typeof getEndpointQuestions>[number]
  ) {
    const origQuestion = originalQuestion ?? question;

    debugLog(`Generating query for ${question.name}`, {
      attempt: retryCount + 1,
      model: `${provider}/${model}`,
      question: question.question.substring(0, 200) + (question.question.length > 200 ? '...' : '')
    });

    const result = await client.generateQuery(question, provider, model, true);

    debugLog(`LLM Response for ${question.name}`, {
      sql: result.sql,
      error: result.error,
      sqlResultSuccess: result.sqlResult?.success,
      sqlResultError: result.sqlResult?.error
    });

    const currentAttempts = [...previousAttempts, result];

    if (
      (result.error ||
        result.sqlResult?.success === false ||
        !!result.sqlResult?.error) &&
      retryCount < MAX_RETRIES
    ) {
      const errorFeedback = `I previously asked: "${question.question}"\n\nYou generated this SQL query:\n\`\`\`sql\n${result.sql}\n\`\`\`\n\nBut it resulted in this error:\n\`\`\`\n${result.error || result.sqlResult?.error}\n\`\`\`\n\nPlease fix the SQL query to correctly answer my original question. Make sure the SQL is valid for Tinybird/ClickHouse.`;

      debugLog(`Retry attempt ${retryCount + 1} for ${question.name}`, {
        errorFeedback: errorFeedback.substring(0, 200) + '...'
      });

      return generateQueryWithRetry(
        {
          ...question,
          question: errorFeedback,
        },
        retryCount + 1,
        currentAttempts,
        origQuestion
      );
    }

    debugLog(`Final result for ${question.name}`, {
      success: result.sqlResult?.success ? true : false,
      attempts: retryCount + 1
    });

    return {
      ...result,
      question: origQuestion,
      model,
      provider,
      attempts: currentAttempts,
    };
  }

  // Filter out completed questions and take first 10
  const pendingQuestions = questions.filter(
    (q) => !completedQuestions.has(q.name)
  );

  // Process questions in batches of 5
  for (let i = 0; i < pendingQuestions.length; i += 5) {
    const batch = pendingQuestions.slice(i, i + 5);
    console.log(
      `Processing batch ${Math.floor(i / 5) + 1} with ${batch.length} questions`
    );

    const batchResults = await Promise.all(
      batch.map((question) => {
        console.log(`Running question: ${question.name}`);
        return generateQueryWithRetry(question);
      })
    );

    results.push(...batchResults);
  }

  return results;
}

main();
