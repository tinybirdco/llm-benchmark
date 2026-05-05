import { queryTinybird } from "./tinybird";
import { calculateRanks, ModelMetrics, ValidationMetrics, ValidationResult } from "./eval";

const devParams: Record<string, string> = process.env.VERCEL_ENV !== 'production' ? { include_unvalidated: '1' } : {};

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

export type QuestionInfo = { name: string; question: string };

export async function fetchLeaderboardData(): Promise<{
  modelMetrics: ModelMetrics[];
  questions: QuestionInfo[];
}> {
  const [tbMetrics, tbValidation, questions] = await Promise.all([
    queryTinybird<TinybirdModelMetrics>("api_model_metrics", devParams),
    queryTinybird<ValidationMetrics>("api_validation_metrics", devParams),
    queryTinybird<QuestionInfo>("api_questions", devParams),
  ]);

  const validationMap = new Map(
    tbValidation.map((v) => [
      `${v.provider}/${v.model}`,
      {
        avgExactDistance: v.avg_exact_distance,
        avgNumericDistance: v.avg_numeric_distance,
        avgFScore: v.avg_fscore,
      },
    ])
  );

  const activeModels = tbMetrics
    .filter((m) => (m.successful_queries ?? 0) > 0)
    .map(toModelMetrics);

  const modelMetrics = calculateRanks(activeModels, validationMap);

  return { modelMetrics, questions };
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
  return queryTinybird<TinybirdResult>("api_results", { model, ...devParams });
}

export async function fetchResultsForQuestion(
  questionName: string
): Promise<TinybirdResult[]> {
  return queryTinybird<TinybirdResult>("api_results", {
    question_name: questionName,
    ...devParams,
  });
}

export async function fetchValidationForModel(
  model: string,
  provider: string
): Promise<ValidationResult[]> {
  return queryTinybird<ValidationResult>("api_validation_results", { model, provider, ...devParams });
}

export async function fetchValidationForQuestion(
  questionName: string
): Promise<ValidationResult[]> {
  return queryTinybird<ValidationResult>("api_validation_results", { question_name: questionName, ...devParams });
}

export async function fetchQuestionList(): Promise<{ name: string; question: string }[]> {
  return queryTinybird<{ name: string; question: string }>("api_results", { model: "human", ...devParams });
}
