import { useMemo } from "react";
import humanResults from "../../benchmark/results-human.json";

export function useHumanResults() {
  return useMemo(() => humanResults, []);
}