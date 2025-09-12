import { useMemo } from "react";
import humanResults from "../../benchmark/results-human.json";
import { useResults } from "./use-results";
import {
  calculateModelMetrics,
  calculateRanks,
  ModelMetrics,
} from "./eval";

type HumanResult = (typeof humanResults)[number];
type ModelResult = ReturnType<typeof useResults>[number];

export const useBenchmarkData = () => {
  const results = useResults();

  const modelMetrics = useMemo(() => {
    const modelGroups = results.reduce(
      (acc: Record<string, ModelResult[]>, result: ModelResult) => {
        const key = result.model;
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      },
      {}
    );

    return calculateRanks(
      Object.values(modelGroups).map((group) => calculateModelMetrics(group))
    );
  }, [results]);

  const humanMetrics = useMemo(() => {
    const modelGroups = humanResults.reduce(
      (acc: Record<string, HumanResult[]>, result: HumanResult) => {
        const key = result.model;
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      },
      {}
    );

    return Object.values(modelGroups).map((group) =>
      calculateModelMetrics(group)
    );
  }, []);

  const getFilteredData = (selectedModels: string[], selectedProviders: string[]) => {
    const allData = [...humanMetrics, ...modelMetrics];
    return allData.filter((item) => {
      const modelMatch =
        selectedModels.length === 0 || selectedModels.includes(item.model);
      const providerMatch =
        selectedProviders.length === 0 ||
        selectedProviders.includes(item.provider);
      return modelMatch && providerMatch;
    });
  };

  return {
    modelMetrics,
    humanMetrics,
    getFilteredData,
  };
};
