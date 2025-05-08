import { ModelResult } from "@/app/types";
import validationResults from "../../benchmark/validation-results.json";

const validationSummaries = validationResults._summary;

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

function mean<T>(arr: T[], f: (x: T) => number | undefined): number {
  if (!arr.length) return 0;
  // debug print
  return arr.reduce((s, x) => s + (f(x) ?? 0), 0) / arr.length;
}

const MAX_FAILURE_PENALTY = Math.pow(2, 10);

export function calculateModelMetrics(
  modelResults: ModelResult[]
): ModelMetrics {
  /* ---------- bookkeeping ---------- */
  const totalQueries = modelResults.length;
  const successes = modelResults.filter((r) => r.sqlResult?.success);
  const fails = totalQueries - successes.length;

  const firstAttemptSuccess = modelResults.filter(
    (r) =>
      r.model === "human" ||
      (r.sqlResult?.success && (r.attempts?.length ?? 1) === 1)
  ).length;

  /* ---------- averages over *successful* queries only ---------- */
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

  /* still useful & cheap to keep, even if failures are included */
  const avgQueryLength = mean(modelResults, (r) => r.sql?.length);
  const avgTokens = mean(modelResults, (r) => r.metrics?.tokens?.totalTokens);

  /* ---------- success / first‑try rates ---------- */
  const successRate = (successes.length / totalQueries) * 100;
  const firstAttemptRate = (firstAttemptSuccess / totalQueries) * 100;

  /* ---------- penalties ---------- */
  const bytesMB = avgBytesRead / (1024 * 1024);
  const rowsM = avgRowsRead / 1_000_000;
  const bytesPerRowKB = avgRowsRead ? avgBytesRead / avgRowsRead / 1024 : 0;

  const attemptsPenalty = Math.pow(avgAttempts, 2); // rough on retries
  const genTimePenalty = Math.pow(avgDur, 0.5); // mild on gen
  const execTimePenalty = Math.pow(avgExecTime, 2); // heavy on runtime
  const rowsPenalty = rowsM;
  const bytesPenalty = bytesMB;
  const bytesPerRowPenalty = Math.pow(bytesPerRowKB, 2); // very heavy for fat reads
  const failurePenalty = Math.min(MAX_FAILURE_PENALTY, Math.pow(2, fails)); // each fail doubles pain

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

  /** `efficiencyScore` will be filled in later when we min‑max / log‑scale
   *   all models together. keep placeholder 0 for now. */
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

    efficiencyScore: 0, // to be set later
    rawEfficiencyScore,
    exactnessScore: 0,
    score: 0,
    rank: 0,
  };
}

// Function to calculate ranks for all models
export function calculateRanks(metrics: ModelMetrics[]): ModelMetrics[] {
  // Find the maximum raw efficiency score to use as reference
  const maxRawScore = Math.max(...metrics.map((m) => m.rawEfficiencyScore));

  // Calculate interpolated scores (0-10 scale, higher is better)
  const metricsWithScores = metrics.map((metric) => {
    const efficiencyScore = 100 * (1 - metric.rawEfficiencyScore / maxRawScore); // Interpolate to 0-10 scale
    const exactnessScore = blendedExactnessScore(metric.provider, metric.model);
    const score = 0.5 * exactnessScore + 0.5 * efficiencyScore;

    return {
      ...metric,
      efficiencyScore,
      exactnessScore,
      score,
    };
  });

  const sortedByScore = [...metricsWithScores].sort(
    (a, b) => b.score - a.score // Sort by interpolated score, higher is better
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

function blendedExactnessScore(provider: string, model: string) {
  const modelKey = `${provider}/${model}`;

  if (
    !validationSummaries.modelStats[
      modelKey as keyof typeof validationSummaries.modelStats
    ]
  ) {
    console.log(`No validation results found for ${modelKey}`);
    return 0;
  }

  const { avgExactDistance, avgNumericDistance, avgFScore } =
    validationSummaries.modelStats[
      modelKey as keyof typeof validationSummaries.modelStats
    ];

  // strong preference for exact, numeric as backup, fscore as minor fallback (it's correlated with jaccard)
  return blendScore(avgExactDistance, avgNumericDistance, avgFScore);
}

function blendScore(exact: number, numeric: number, fscore: number) {
  return 100 * (0.65 * (1 - exact) + 0.25 * (1 - numeric) + 0.1 * fscore);
}

export function getExactnessScore(
  provider: string,
  model: string,
  question: string
) {
  const modelKey = `${provider}/${model}`;

  const pipe = validationResults[question as "pipe_01.pipe"];
  if (!pipe) {
    console.log(`No validation results found for question: ${question}`);
    return 0;
  }

  const modelResults = pipe.models[modelKey as keyof typeof pipe.models];

  if (!modelResults) {
    console.log(`No validation results found for m: ${modelKey}`);
    return 0;
  }

  return blendScore(
    modelResults.distance.exact,
    modelResults.distance.numeric,
    modelResults.distance.fScore
  );
}
