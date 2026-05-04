import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";

config({ path: path.join(__dirname, "../.env.local") });

const TINYBIRD_API_HOST = process.env.TINYBIRD_API_HOST!;
const TINYBIRD_WORKSPACE_TOKEN = process.env.TINYBIRD_WORKSPACE_TOKEN!;
const BATCH_SIZE = 1000;

interface RawResult {
  sql?: string;
  sqlResult?: {
    success: boolean;
    data?: unknown[];
    executionTime?: number;
    error?: string;
    statistics?: {
      elapsed?: number;
      rows_read?: number;
      bytes_read?: number;
    };
  };
  name: string;
  question: {
    name?: string;
    content?: string;
    question?: string;
  };
  model: string;
  provider: string;
  metrics?: {
    timeToFirstToken: number;
    totalDuration: number;
    tokens: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  error?: string | null;
  attempts?: unknown[];
}

function extractDescription(content: string | undefined): string {
  if (!content) return "";
  const match = content.match(/DESCRIPTION\s*>\s*\n([\s\S]*?)(?=\nNODE|\nSQL|\nTYPE|$)/);
  if (!match) return content.substring(0, 200);
  return match[1].trim().replace(/\s+/g, " ");
}

function transformResult(r: RawResult): string {
  const isHuman = r.model === "human" && r.provider === "human";
  const numAttempts = r.attempts?.length ?? 1;
  const firstAttemptSuccess =
    isHuman
      ? 1
      : numAttempts === 1 && r.sqlResult?.success
        ? 1
        : 0;

  const row = {
    sql: r.sql ?? "",
    sql_result_success: r.sqlResult?.success ? 1 : 0,
    sql_result_execution_time: r.sqlResult?.executionTime ?? 0,
    sql_result_error: (r.sqlResult?.error ?? "").substring(0, 500),
    sql_result_query_latency: r.sqlResult?.statistics?.elapsed ?? null,
    sql_result_rows_read: r.sqlResult?.statistics?.rows_read ?? null,
    sql_result_bytes_read: r.sqlResult?.statistics?.bytes_read ?? null,
    name: r.name,
    question: extractDescription(r.question?.content),
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
  };
  return JSON.stringify(row);
}

async function pushBatch(ndjsonLines: string[], batchNum: number): Promise<void> {
  const body = ndjsonLines.join("\n");
  const res = await fetch(`${TINYBIRD_API_HOST}/v0/events?name=benchmark_results`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TINYBIRD_WORKSPACE_TOKEN}` },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Batch ${batchNum} failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  console.log(`  Batch ${batchNum}: ${json.successful_rows}/${ndjsonLines.length} rows ingested`);
}

async function migrate() {
  if (!TINYBIRD_API_HOST || !TINYBIRD_WORKSPACE_TOKEN) {
    console.error("Missing TINYBIRD_API_HOST or TINYBIRD_WORKSPACE_TOKEN in .env");
    process.exit(1);
  }

  console.log(`Target: ${TINYBIRD_API_HOST}`);
  console.log("Loading results.json...");
  const results: RawResult[] = JSON.parse(
    readFileSync(path.join(__dirname, "results.json"), "utf8")
  );
  console.log(`Loaded ${results.length} benchmark results`);

  console.log("Loading results-human.json...");
  const humanResults: RawResult[] = JSON.parse(
    readFileSync(path.join(__dirname, "results-human.json"), "utf8")
  );
  console.log(`Loaded ${humanResults.length} human results`);

  const allResults = [...results, ...humanResults];
  const transformed = allResults.map(transformResult);
  console.log(`Transformed ${transformed.length} rows to NDJSON`);

  const totalBatches = Math.ceil(transformed.length / BATCH_SIZE);
  console.log(`Pushing ${totalBatches} batches of up to ${BATCH_SIZE} rows...`);

  for (let i = 0; i < transformed.length; i += BATCH_SIZE) {
    const batch = transformed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    await pushBatch(batch, batchNum);
  }

  console.log(`\nMigration complete. ${transformed.length} rows pushed to Tinybird.`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
