import { type useResults } from "./use-results";

export function calculateModelMetrics(
  modelResults: ReturnType<typeof useResults>
) {
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
  const bytesPerRowKB = (totalBytesRead / totalRowsRead) / 1024; // bytes per row in KB

  // penalty terms with different exponents
  const attemptsPenalty = Math.pow(avgAttempts, 2);           // brutal on retries
  const genTimePenalty = Math.pow(avgTotalDuration, 0.5);     // mild on llm gen time
  const execTimePenalty = Math.pow(avgExecutionTime, 2);      // heavy on runtime
  const rowsPenalty = rowsM;                                  // extra cost per scanned row
  const bytesPenalty = bytesMB;                              // cost per scanned byte
  const bytesPerRowPenalty = Math.pow(bytesPerRowKB, 2);     // very heavy if you pull fat columns

  const penalty = attemptsPenalty * genTimePenalty * execTimePenalty * 
                 rowsPenalty * bytesPenalty * bytesPerRowPenalty;

  const efficiencyScore = Math.sqrt(penalty / C); // inverted: lower is better

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
    avgBytesRead,
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
export function calculateRanks(
  metrics: ReturnType<typeof calculateModelMetrics>[]
) {
  const sortedByEfficiency = [...metrics].sort(
    (a, b) => a.efficiencyScore - b.efficiencyScore
  );
  return metrics.map((metric) => ({
    ...metric,
    rank:
      sortedByEfficiency.findIndex(
        (m) => m.model === metric.model && m.provider === metric.provider
      ) + 1,
  }));
}
