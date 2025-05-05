import { useResults } from "./use-results";

export function useSingleResult(model: string, question: string) {
  const results = useResults();

  return results.find(
    (result) => result.model === model && result.name === question
  );
}
