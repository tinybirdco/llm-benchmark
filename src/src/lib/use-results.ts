import { useMemo } from "react";
import benchmarkResults from "../../benchmark/results.json";
import { BenchmarkResults } from "../app/types";

export function useResults(): BenchmarkResults {
  const results = useMemo(() => {
    return benchmarkResults as BenchmarkResults;
  }, []);

  return results;
}