import { getClient } from "./client";
import { getConfig } from "./config";
import { getEndpointQuestions } from "./resources";
import { ChatResponse, SqlResult } from "./types";
import { compareResults } from "./result-validator";

const MAX_RETRIES = 2;

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
  --validate                 Validate (mark as reviewed) existing results for the specified model in Tinybird
  --revalidate               Re-run exactness validation for a model using existing LLM results from Tinybird
  --skip-validation          Skip validating results against human baseline
  --debug                    Enable debug mode to log LLM requests and responses
  --help                     Display this help message

Examples:
  npm run benchmark -- --model=x-ai/grok-3-beta
  npm run benchmark -- --model=x-ai/grok-3-beta --debug
  npm run benchmark -- --model=x-ai/grok-3-beta --validate
  npm run benchmark -- --skip-validation
  `);
}

// Parse command line arguments
function parseArgs(): { model?: string; validate?: boolean; revalidate?: boolean; skipValidation?: boolean; debug?: boolean; help?: boolean } {
  const args: { model?: string; validate?: boolean; revalidate?: boolean; skipValidation?: boolean; debug?: boolean; help?: boolean } = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--model=')) {
      args.model = arg.substring('--model='.length);
    } else if (arg === '--model' && i + 1 < process.argv.length) {
      args.model = process.argv[i + 1];
      i++;
    } else if (arg === '--validate') {
      args.validate = true;
    } else if (arg === '--revalidate') {
      args.revalidate = true;
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

async function fetchHumanResults(): Promise<ChatResponse[]> {
  const client = getClient();
  const endpoints = getEndpointQuestions();
  const results: ChatResponse[] = [];

  console.log("Executing human SQL queries for validation baseline...");
  for (const endpoint of endpoints) {
    const sql = endpoint.content
      .split("SQL >")[1]
      .split("TYPE endpoint")[0]
      .trim();

    const result = await client.executeSqlQuery(sql);
    results.push({
      name: endpoint.name,
      question: { name: endpoint.name, content: endpoint.question } as any,
      sql,
      sqlResult: result,
      model: "human",
      provider: "human",
      error: null,
      attempts: [],
    } as any);
  }

  console.log(`Fetched ${results.length} human baseline results`);
  return results;
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
      validated: 0,
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
        validated: 0,
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

async function validateResults(results: ChatResponse[], humanResults: ChatResponse[]): Promise<Record<string, ValidationResult | ValidationSummary>> {
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

    if (result.model === "human" && result.provider === "human") {
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

async function validateModel(modelString: string) {
  const [providerName, ...modelParts] = modelString.split('/');
  const modelName = modelParts.join('/');

  if (!providerName || !modelName) {
    console.error("Invalid model format. Please use format: --model=provider/model");
    process.exit(1);
  }

  const { tinybird } = getConfig();
  if (!tinybird.workspaceToken) {
    console.error("TINYBIRD_WORKSPACE_TOKEN is required for validation");
    process.exit(1);
  }

  console.log(`Validating results for ${providerName}/${modelName}...`);

  const escapedProvider = providerName.replace(/'/g, "\\'");
  const escapedModel = modelName.replace(/'/g, "\\'");

  const resultsQuery = `SELECT * FROM benchmark_results FINAL WHERE model = '${escapedModel}' AND provider = '${escapedProvider}' FORMAT JSON`;
  const resultsRes = await fetch(
    `${tinybird.apiHost}/v0/sql?q=${encodeURIComponent(resultsQuery)}`,
    { headers: { Authorization: `Bearer ${tinybird.workspaceToken}` } }
  );

  if (!resultsRes.ok) {
    const text = await resultsRes.text();
    console.error(`Failed to query benchmark_results (${resultsRes.status}): ${text}`);
    process.exit(1);
  }

  const resultsData = await resultsRes.json();
  const resultRows = resultsData.data ?? [];

  if (resultRows.length === 0) {
    console.log("No results found for this model.");
    return;
  }

  const resultsNdjson = resultRows.map((row: Record<string, unknown>) =>
    JSON.stringify({ ...row, validated: 1, ingested_at: new Date().toISOString().replace('T', ' ').substring(0, 19) })
  ).join("\n");

  const pushResultsRes = await fetch(`${tinybird.apiHost}/v0/events?name=benchmark_results`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tinybird.workspaceToken}` },
    body: resultsNdjson,
  });

  if (!pushResultsRes.ok) {
    const text = await pushResultsRes.text();
    console.error(`Failed to push validated results (${pushResultsRes.status}): ${text}`);
    process.exit(1);
  }

  const pushResultsJson = await pushResultsRes.json();
  console.log(`Validated ${pushResultsJson.successful_rows} benchmark results`);

  const validationQuery = `SELECT * FROM benchmark_validation FINAL WHERE model = '${escapedModel}' AND provider = '${escapedProvider}' FORMAT JSON`;
  const validationRes = await fetch(
    `${tinybird.apiHost}/v0/sql?q=${encodeURIComponent(validationQuery)}`,
    { headers: { Authorization: `Bearer ${tinybird.workspaceToken}` } }
  );

  if (!validationRes.ok) {
    const text = await validationRes.text();
    console.error(`Failed to query benchmark_validation (${validationRes.status}): ${text}`);
    process.exit(1);
  }

  const validationData = await validationRes.json();
  const validationRows = validationData.data ?? [];

  if (validationRows.length > 0) {
    const validationNdjson = validationRows.map((row: Record<string, unknown>) =>
      JSON.stringify({ ...row, validated: 1, ingested_at: new Date().toISOString().replace('T', ' ').substring(0, 19) })
    ).join("\n");

    const pushValidationRes = await fetch(`${tinybird.apiHost}/v0/events?name=benchmark_validation`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tinybird.workspaceToken}` },
      body: validationNdjson,
    });

    if (!pushValidationRes.ok) {
      const text = await pushValidationRes.text();
      console.error(`Failed to push validated validation results (${pushValidationRes.status}): ${text}`);
      process.exit(1);
    }

    const pushValidationJson = await pushValidationRes.json();
    console.log(`Validated ${pushValidationJson.successful_rows} validation results`);
  }

  console.log(`Model ${providerName}/${modelName} has been validated.`);
}

async function revalidateModel(modelString: string) {
  const [providerName, ...modelParts] = modelString.split('/');
  const modelName = modelParts.join('/');

  if (!providerName || !modelName) {
    console.error("Invalid model format. Please use format: --model=provider/model");
    process.exit(1);
  }

  const { tinybird } = getConfig();
  if (!tinybird.workspaceToken) {
    console.error("TINYBIRD_WORKSPACE_TOKEN is required");
    process.exit(1);
  }

  console.log(`Re-validating results for ${providerName}/${modelName}...`);

  const llmRes = await fetch(
    `${tinybird.apiHost}/v0/pipes/api_results.json?model=${encodeURIComponent(modelName)}&include_unvalidated=1`,
    { headers: { Authorization: `Bearer ${tinybird.workspaceToken}` } }
  );

  if (!llmRes.ok) {
    console.error(`Failed to fetch LLM results: ${await llmRes.text()}`);
    process.exit(1);
  }

  const llmData = await llmRes.json();
  const llmResults = (llmData.data ?? []).filter((r: any) => r.provider === providerName);

  if (llmResults.length === 0) {
    console.log("No results found for this model.");
    return;
  }

  console.log(`Found ${llmResults.length} LLM results in Tinybird`);

  const client = getClient();
  const endpoints = getEndpointQuestions();
  const humanResults = await fetchHumanResults();
  const humanByQuestion = new Map(humanResults.map((r: any) => [r.name, r]));

  const chatResults: ChatResponse[] = [];
  for (const llmEntry of llmResults) {
    if (!llmEntry.sql_result_success || !llmEntry.sql) continue;

    const sqlResult = await client.executeSqlQuery(llmEntry.sql);
    chatResults.push({
      name: llmEntry.name,
      question: { name: llmEntry.name } as any,
      sql: llmEntry.sql,
      sqlResult,
      model: modelName,
      provider: providerName,
      error: null,
      attempts: [],
    } as any);
  }

  console.log(`Re-executed ${chatResults.length} LLM queries`);

  await validateResults(chatResults, humanResults);
  console.log("Re-validation complete. Fresh validation data pushed to Tinybird.");
}

async function verifyTinybirdCredentials() {
  const { tinybird } = getConfig();
  if (!tinybird.apiHost || !tinybird.workspaceToken) {
    console.error("TINYBIRD_API_HOST and TINYBIRD_WORKSPACE_TOKEN are required");
    process.exit(1);
  }

  try {
    const res = await fetch(`${tinybird.apiHost}/v0/sql?q=${encodeURIComponent("SELECT 1 FORMAT JSON")}`, {
      headers: { Authorization: `Bearer ${tinybird.workspaceToken}` },
    });
    if (!res.ok) {
      console.error(`Tinybird credentials check failed (HTTP ${res.status}): ${await res.text()}`);
      process.exit(1);
    }
    console.log("Tinybird credentials verified");
  } catch (err) {
    console.error("Cannot connect to Tinybird:", err);
    process.exit(1);
  }
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

  await verifyTinybirdCredentials();

  if (args.validate) {
    if (!args.model) {
      console.error("--validate requires --model=provider/model");
      process.exit(1);
    }
    await validateModel(args.model);
    return;
  }

  if (args.revalidate) {
    if (!args.model) {
      console.error("--revalidate requires --model=provider/model");
      process.exit(1);
    }
    await revalidateModel(args.model);
    return;
  }

  if (!args.model) {
    console.error("--model=provider/model is required");
    printUsage();
    process.exit(1);
  }

  console.log(`Running benchmark for model: ${args.model}`);
  await runBenchmarkForModel(args.model);
}

export async function runHumanQueries() {
  const results = await fetchHumanResults();
  await pushToTinybird(results as any);
  console.log("Human results pushed to Tinybird.");
}

async function runBenchmarkForModel(modelString: string) {
  const [providerName, ...modelParts] = modelString.split('/');
  const modelName = modelParts.join('/');

  if (!providerName || !modelName) {
    console.error("Invalid model format. Please use format: --model=provider/model");
    process.exit(1);
  }

  console.log(`Benchmarking ${providerName}/${modelName}`);

  const results = await runModelBenchmark(providerName, modelName);
  await pushToTinybird(results);

  const args = parseArgs();
  if (!args.skipValidation) {
    console.log("Validating results against human baseline...");
    const humanResults = await fetchHumanResults();
    await validateResults(results, humanResults);
    console.log("Validation complete. Results pushed to Tinybird.");
  }
}

async function runModelBenchmark(
  provider: string,
  model: string,
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

  for (let i = 0; i < questions.length; i += 5) {
    const batch = questions.slice(i, i + 5);
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
