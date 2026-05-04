import { queryTinybird } from "./tinybird";
import { calculateRanks, ModelMetrics } from "./eval";
import humanResults from "../../benchmark/results-human.json";

type TinybirdModelMetrics = {
  model: string;
  provider: string;
  total_queries: number;
  successful_queries: number;
  first_attempt_successes: number;
  avg_execution_time: number;
  avg_time_to_first_token: number;
  avg_total_duration: number;
  avg_rows_read: number;
  avg_bytes_read: number;
  avg_query_length: number;
  avg_tokens: number;
  avg_attempts: number;
  success_rate: number;
  first_attempt_rate: number;
};

const MAX_FAILURE_PENALTY = Math.pow(2, 10);

function computePenalty(m: TinybirdModelMetrics): number {
  const fails = (m.total_queries ?? 0) - (m.successful_queries ?? 0);
  const avgBytesRead = m.avg_bytes_read ?? 0;
  const avgRowsRead = m.avg_rows_read ?? 0;
  const bytesMB = avgBytesRead / (1024 * 1024);
  const rowsM = avgRowsRead / 1_000_000;
  const bytesPerRowKB = avgRowsRead
    ? avgBytesRead / avgRowsRead / 1024
    : 0;

  const attemptsPenalty = Math.pow(m.avg_attempts || 1, 2);
  const genTimePenalty = Math.pow(m.avg_total_duration || 0.001, 0.5);
  const execTimePenalty = Math.pow(m.avg_execution_time || 0.001, 2);
  const rowsPenalty = rowsM || 0.001;
  const bytesPenalty = bytesMB || 0.001;
  const bytesPerRowPenalty = Math.pow(bytesPerRowKB || 0.001, 2);
  const failurePenalty = Math.min(MAX_FAILURE_PENALTY, Math.pow(2, fails));

  const C = 200_000;
  const penalty =
    attemptsPenalty *
    genTimePenalty *
    execTimePenalty *
    rowsPenalty *
    bytesPenalty *
    bytesPerRowPenalty *
    failurePenalty;

  return Math.sqrt(penalty / C);
}

function toModelMetrics(m: TinybirdModelMetrics): ModelMetrics {
  const safe = (v: number | null | undefined) => v ?? 0;
  const rawEfficiencyScore = computePenalty(m);

  return {
    model: m.model,
    provider: m.provider,
    name: m.model,
    totalQueries: safe(m.total_queries),
    successfulQueries: safe(m.successful_queries),
    firstAttemptSuccess: safe(m.first_attempt_successes),
    avgExecutionTime: safe(m.avg_execution_time),
    avgTimeToFirstToken: safe(m.avg_time_to_first_token),
    avgTotalDuration: safe(m.avg_total_duration),
    totalBytesRead: safe(m.avg_bytes_read) * safe(m.successful_queries),
    totalRowsRead: safe(m.avg_rows_read) * safe(m.successful_queries),
    avgRowsRead: safe(m.avg_rows_read),
    avgBytesRead: safe(m.avg_bytes_read),
    avgQueryLength: safe(m.avg_query_length),
    avgTokens: safe(m.avg_tokens),
    avgAttempts: safe(m.avg_attempts),
    successRate: safe(m.success_rate),
    firstAttemptRate: safe(m.first_attempt_rate),
    efficiencyScore: 0,
    rawEfficiencyScore,
    exactnessScore: 0,
    score: 0,
    rank: 0,
  };
}

function computeHumanMetrics(): ModelMetrics[] {
  const group = humanResults as any[];
  const successes = group.filter((r: any) => r.sqlResult?.success);

  const mean = <T,>(arr: T[], f: (x: T) => number | undefined): number => {
    if (!arr.length) return 0;
    return arr.reduce((s: number, x: T) => s + (f(x) ?? 0), 0) / arr.length;
  };

  return [
    {
      model: "human",
      provider: "human",
      name: "human",
      totalQueries: group.length,
      successfulQueries: successes.length,
      firstAttemptSuccess: group.length,
      avgExecutionTime: mean(successes, (r: any) => r.sqlResult?.executionTime),
      avgTimeToFirstToken: 0,
      avgTotalDuration: 0,
      totalBytesRead: successes.reduce(
        (s: number, r: any) => s + (r.sqlResult?.statistics?.bytes_read ?? 0),
        0
      ),
      totalRowsRead: successes.reduce(
        (s: number, r: any) => s + (r.sqlResult?.statistics?.rows_read ?? 0),
        0
      ),
      avgRowsRead: mean(
        successes,
        (r: any) => r.sqlResult?.statistics?.rows_read
      ),
      avgBytesRead: mean(
        successes,
        (r: any) => r.sqlResult?.statistics?.bytes_read
      ),
      avgQueryLength: mean(group, (r: any) => r.sql?.length),
      avgTokens: 0,
      avgAttempts: 1,
      successRate: (successes.length / group.length) * 100,
      firstAttemptRate: 100,
      efficiencyScore: 0,
      rawEfficiencyScore: 0,
      exactnessScore: 0,
      score: 0,
      rank: 0,
    },
  ];
}

export async function fetchLeaderboardData(): Promise<{
  modelMetrics: ModelMetrics[];
  humanMetrics: ModelMetrics[];
}> {
  const tbMetrics =
    await queryTinybird<TinybirdModelMetrics>("api_model_metrics");

  const modelMetrics = calculateRanks(tbMetrics.map(toModelMetrics));
  const humanMetrics = computeHumanMetrics();

  return { modelMetrics, humanMetrics };
}

export type TinybirdResult = {
  sql: string;
  sql_result_success: number;
  sql_result_execution_time: number;
  sql_result_error: string;
  sql_result_query_latency: number | null;
  sql_result_rows_read: number | null;
  sql_result_bytes_read: number | null;
  name: string;
  question: string;
  model: string;
  provider: string;
  llm_time_to_first_token: number;
  llm_total_duration: number;
  llm_prompt_tokens: number;
  llm_completion_tokens: number;
  llm_total_tokens: number;
  llm_error: string;
  num_attempts: number;
  first_attempt_success: number;
};

export async function fetchResultsForModel(
  model: string
): Promise<TinybirdResult[]> {
  return queryTinybird<TinybirdResult>("api_results", { model });
}

export async function fetchResultsForQuestion(
  questionName: string
): Promise<TinybirdResult[]> {
  return queryTinybird<TinybirdResult>("api_results", {
    question_name: questionName,
  });
}
