import { useResults } from "./use-results";
import { useHumanResults } from "./use-human-results";

export function useSingleResult(model: string, question: string) {
  const results = useResults();
  const humanResults = useHumanResults();

  if (humanResults && model === "human") {
    return humanResults.find((result) => result.name === question);
  }

  return results.find(
    (result) => result.model === model && result.name === question
  );
}
