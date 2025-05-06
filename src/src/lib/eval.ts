import { type useResults } from "./use-results";
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
  rank: number;
};

export function calculateModelMetrics(
  modelResults: ModelResult[]
): ModelMetrics {
  const totalQueries = modelResults.length;
  const successfulQueries = modelResults.filter(
    (r) => r.sqlResult?.success
  ).length;
  const firstAttemptSuccess = modelResults.filter(
    (r) =>
      r.model === "human" || (r.sqlResult?.success && r.attempts.length === 1)
  ).length;

  const avgExecutionTime =
    modelResults.reduce(
      (acc, r) => acc + (r.sqlResult?.executionTime || 0),
      0
    ) / totalQueries;
  const avgTimeToFirstToken =
    modelResults.reduce(
      (acc, r) => acc + (r.metrics?.timeToFirstToken || 0),
      0
    ) / totalQueries;
  const avgTotalDuration =
    modelResults.reduce((acc, r) => acc + (r.metrics?.totalDuration || 0), 0) /
    totalQueries;

  const totalBytesRead = modelResults.reduce(
    (acc, r) => acc + (r.sqlResult?.statistics?.bytes_read || 0),
    0
  );

  const totalRowsRead = modelResults.reduce(
    (acc, r) => acc + (r.sqlResult?.statistics?.rows_read || 0),
    0
  );
  const avgRowsRead = totalRowsRead / totalQueries;
  const avgBytesRead = totalBytesRead / totalQueries;

  const avgQueryLength =
    modelResults.reduce((acc, r) => acc + (r.sql?.length || 0), 0) /
    totalQueries;

  const avgTokens =
    modelResults.reduce(
      (acc, r) => acc + (r.metrics?.tokens?.totalTokens || 0),
      0
    ) / totalQueries;
  const avgAttempts =
    modelResults.reduce(
      (acc, r) => acc + (r.model === "human" ? 1 : r.attempts?.length || 1),
      0
    ) / totalQueries;

  const successRate = (successfulQueries / totalQueries) * 100;
  const firstAttemptRate = (firstAttemptSuccess / totalQueries) * 100;

  const C = 200_000; // scaling constant

  const bytesMB = totalBytesRead / (1024 * 1024); // convert to MB
  const rowsM = totalRowsRead / 1_000_000; // convert to millions
  const bytesPerRowKB = (totalBytesRead / totalRowsRead) / 1024;

  // Count failed queries
  const failedQueries = modelResults.filter(r => !r.sqlResult?.success).length;
  const failurePenalty = Math.pow(2, failedQueries); // exponential penalty for each failure

  // penalty terms with different exponents
  const attemptsPenalty = Math.pow(avgAttempts, 2);           // brutal on retries
  const genTimePenalty = Math.pow(avgTotalDuration, 0.5);     // mild on llm gen time
  const execTimePenalty = Math.pow(avgExecutionTime, 2);      // heavy on runtime
  const rowsPenalty = rowsM;                                  // extra cost per scanned row
  const bytesPenalty = bytesMB;                              // cost per scanned byte
  const bytesPerRowPenalty = Math.pow(bytesPerRowKB, 2);     // very heavy if you pull fat columns

  const penalty = attemptsPenalty * genTimePenalty * execTimePenalty *
    rowsPenalty * bytesPenalty * bytesPerRowPenalty * failurePenalty;

  // Calculate raw efficiency score (lower is better)
  const rawEfficiencyScore = Math.sqrt(penalty / C);

  // Find the maximum raw score across all models to use as reference
  // This will be done in calculateRanks function
  const efficiencyScore = 0; // Placeholder, will be set in calculateRanks

  return {
    model: modelResults[0].model,
    provider: modelResults[0].provider,
    name: modelResults[0].name,
    totalQueries,
    successfulQueries,
    firstAttemptSuccess,
    avgExecutionTime,
    avgTimeToFirstToken,
    avgTotalDuration,
    totalBytesRead,
    totalRowsRead,
    avgRowsRead,
    avgBytesRead,
    avgQueryLength,
    avgTokens,
    avgAttempts,
    successRate,
    firstAttemptRate,
    efficiencyScore,
    rawEfficiencyScore,
    rank: 0, // This will be calculated after all metrics are computed
  };
}

// Function to calculate ranks for all models
export function calculateRanks(
  metrics: ModelMetrics[]
): ModelMetrics[] {
  // Find the maximum raw efficiency score to use as reference
  const maxRawScore = Math.max(...metrics.map(m => m.rawEfficiencyScore));

  // Calculate interpolated scores (0-10 scale, higher is better)
  const metricsWithScores = metrics.map(metric => ({
    ...metric,
    efficiencyScore: 100 * (1 - (metric.rawEfficiencyScore / maxRawScore)), // Interpolate to 0-10 scale
  }));

  const sortedByEfficiency = [...metricsWithScores].sort(
    (a, b) => b.efficiencyScore - a.efficiencyScore // Sort by interpolated score, higher is better
  );

  return metricsWithScores.map((metric) => ({
    ...metric,
    rank:
      sortedByEfficiency.findIndex(
        (m) => m.model === metric.model && m.provider === metric.provider
      ) + 1,
  }));
}
