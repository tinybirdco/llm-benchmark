import { useMemo } from "react";
import benchmarkResults from "../../benchmark/results.json";

export function useResults() {
  const results = useMemo(() => {
    return benchmarkResults;
  }, []);

  return results;
}