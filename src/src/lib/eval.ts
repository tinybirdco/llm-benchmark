import { type useResults } from "./use-results";

export function calculateModelMetrics(modelResults: ReturnType<typeof useResults>) {
  const totalQueries = modelResults.length;
  const successfulQueries = modelResults.filter(
    (r) => r.sqlResult?.success
  ).length;
  const firstAttemptSuccess = modelResults.filter(
    (r) => r.sqlResult?.success && r.attempts.length === 1
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

  const avgQueryLength =
    modelResults.reduce((acc, r) => acc + (r.sql?.length || 0), 0) /
    totalQueries;
  const avgTokens =
    modelResults.reduce(
      (acc, r) => acc + (r.metrics?.tokens?.totalTokens || 0),
      0
    ) / totalQueries;
  const avgAttempts =
    modelResults.reduce((acc, r) => acc + (r.attempts?.length || 1), 0) /
    totalQueries;

  const successRate = (successfulQueries / totalQueries) * 100;
  const firstAttemptRate = (firstAttemptSuccess / totalQueries) * 100;

  // Efficiency score (lower is better) - custom metric combining execution time, data read, and success rate
  const efficiencyScore =
    (avgExecutionTime * 1000 + totalBytesRead / 1000000) / (successRate + 1);

  return {
    model: modelResults[0].model,
    provider: modelResults[0].provider,
    totalQueries,
    successfulQueries,
    firstAttemptSuccess,
    avgExecutionTime,
    avgTimeToFirstToken,
    avgTotalDuration,
    totalBytesRead,
    totalRowsRead,
    avgRowsRead,
    avgQueryLength,
    avgTokens,
    avgAttempts,
    successRate,
    firstAttemptRate,
    efficiencyScore,
    rank: 0, // This will be calculated after all metrics are computed
  };
}

// Function to calculate ranks for all models
export function calculateRanks(metrics: ReturnType<typeof calculateModelMetrics>[]) {
  const sortedByEfficiency = [...metrics].sort((a, b) => a.efficiencyScore - b.efficiencyScore);
  return metrics.map(metric => ({
    ...metric,
    rank: sortedByEfficiency.findIndex(m => m.model === metric.model && m.provider === metric.provider) + 1
  }));
}
