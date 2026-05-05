import { ModelResult } from "@/app/types";

export type ModelMetrics = {
  model: string;
  provider: string;
  name: string;
  totalQueries: number;
  successfulQueries: number;
  firstAttemptSuccess: number;
  avgExecutionTime: number;
  avgTimeToFirstToken: number;
  avgTotalDuration: number;
  totalBytesRead: number;
  totalRowsRead: number;
  avgRowsRead: number;
  avgBytesRead: number;
  avgQueryLength: number;
  avgTokens: number;
  avgAttempts: number;
  successRate: number;
  firstAttemptRate: number;
  efficiencyScore: number;
  rawEfficiencyScore: number;
  exactnessScore: number;
  score: number;
  rank: number;
};

export type ValidationMetrics = {
  model: string;
  provider: string;
  total_questions: number;
  total_matches: number;
  avg_exact_distance: number;
  avg_numeric_distance: number;
  avg_fscore: number;
};

export type ValidationResult = {
  model: string;
  provider: string;
  name: string;
  matches: number;
  exact_matches: number;
  numeric_matches: number;
  distance_exact: number;
  distance_numeric: number;
  distance_fscore: number;
  human_row_count: number;
  llm_row_count: number;
};

function mean<T>(arr: T[], f: (x: T) => number | undefined): number {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + (f(x) ?? 0), 0) / arr.length;
}

const MAX_FAILURE_PENALTY = Math.pow(2, 10);

export function calculateModelMetrics(
  modelResults: ModelResult[]
): ModelMetrics {
  const totalQueries = modelResults.length;
  const successes = modelResults.filter((r) => r.sqlResult?.success);
  const fails = totalQueries - successes.length;

  const firstAttemptSuccess = modelResults.filter(
    (r) =>
      r.model === "human" ||
      (r.sqlResult?.success && (r.attempts?.length ?? 1) === 1)
  ).length;

  const avgExecTime = mean(successes, (r) => r.sqlResult!.executionTime);
  const avgTTFT = mean(successes, (r) =>
    r.model === "human" ? 0 : r.metrics!.timeToFirstToken
  );
  const avgDur = mean(successes, (r) =>
    r.model === "human" ? 0 : r.metrics!.totalDuration
  );

  const avgBytesRead = mean(
    successes,
    (r) => r.sqlResult!.statistics!.bytes_read
  );
  const avgRowsRead = mean(
    successes,
    (r) => r.sqlResult!.statistics!.rows_read
  );

  const avgAttempts = mean(successes, (r) =>
    r.model === "human" ? 1 : r.attempts?.length ?? 1
  );

  const avgQueryLength = mean(modelResults, (r) => r.sql?.length);
  const avgTokens = mean(modelResults, (r) => r.metrics?.tokens?.totalTokens);

  const successRate = (successes.length / totalQueries) * 100;
  const firstAttemptRate = (firstAttemptSuccess / totalQueries) * 100;

  const bytesMB = avgBytesRead / (1024 * 1024);
  const rowsM = avgRowsRead / 1_000_000;
  const bytesPerRowKB = avgRowsRead ? avgBytesRead / avgRowsRead / 1024 : 0;

  const attemptsPenalty = Math.pow(avgAttempts, 2);
  const genTimePenalty = Math.pow(avgDur, 0.5);
  const execTimePenalty = Math.pow(avgExecTime, 2);
  const rowsPenalty = rowsM;
  const bytesPenalty = bytesMB;
  const bytesPerRowPenalty = Math.pow(bytesPerRowKB, 2);
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

  const rawEfficiencyScore = Math.sqrt(penalty / C);

  return {
    model: modelResults[0].model,
    provider: modelResults[0].provider,
    name: modelResults[0].name,

    totalQueries,
    successfulQueries: successes.length,
    firstAttemptSuccess,

    avgExecutionTime: avgExecTime,
    avgTimeToFirstToken: avgTTFT,
    avgTotalDuration: avgDur,

    totalBytesRead: avgBytesRead * successes.length,
    totalRowsRead: avgRowsRead * successes.length,
    avgRowsRead,
    avgBytesRead,

    avgQueryLength,
    avgTokens,
    avgAttempts,

    successRate,
    firstAttemptRate,

    efficiencyScore: 0,
    rawEfficiencyScore,
    exactnessScore: 0,
    score: 0,
    rank: 0,
  };
}

export function calculateRanks(
  metrics: ModelMetrics[],
  validationMap: Map<string, { avgExactDistance: number; avgNumericDistance: number; avgFScore: number }>
): ModelMetrics[] {
  const maxRawScore = Math.max(...metrics.map((m) => m.rawEfficiencyScore));

  const metricsWithScores = metrics.map((metric) => {
    const efficiencyScore = maxRawScore > 0
      ? 100 * (1 - metric.rawEfficiencyScore / maxRawScore)
      : 0;

    const modelKey = `${metric.provider}/${metric.model}`;
    const validation = validationMap.get(modelKey);
    const exactnessScore = validation
      ? blendScore(validation.avgExactDistance, validation.avgNumericDistance, validation.avgFScore)
      : 0;

    const score = 0.5 * exactnessScore + 0.5 * efficiencyScore;

    return {
      ...metric,
      efficiencyScore,
      exactnessScore,
      score,
    };
  });

  const sortedByScore = [...metricsWithScores].sort(
    (a, b) => b.score - a.score
  );

  return metricsWithScores.map((metric) => {
    return {
      ...metric,
      rank:
        sortedByScore.findIndex(
          (m) => m.model === metric.model && m.provider === metric.provider
        ) + 1,
    };
  });
}

function blendScore(exact: number, numeric: number, fscore: number) {
  return 100 * (0.65 * (1 - exact) + 0.25 * (1 - numeric) + 0.1 * fscore);
}

export function getExactnessScoreFromValidation(
  validationResults: ValidationResult[],
  provider: string,
  model: string,
  question: string
): number {
  const match = validationResults.find(
    (v) => v.provider === provider && v.model === model && v.name === question
  );
  if (!match) return 0;
  return blendScore(match.distance_exact, match.distance_numeric, match.distance_fscore);
}
