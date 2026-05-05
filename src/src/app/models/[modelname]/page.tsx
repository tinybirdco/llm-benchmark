import {
  fetchResultsForModel,
  fetchValidationForModel,
  TinybirdResult,
} from "@/lib/fetch-benchmark-data";
import { ModelDetailClient } from "./model-detail-client";

export const revalidate = 300;

export default async function ModelDetail({
  params,
}: {
  params: Promise<{ modelname: string }>;
}) {
  const { modelname } = await params;
  const modelName = decodeURIComponent(modelname);

  const results = await fetchResultsForModel(modelName);

  const provider = results[0]?.provider ?? "";
  const validationResults = provider
    ? await fetchValidationForModel(modelName, provider)
    : [];

  return (
    <ModelDetailClient
      modelName={modelName}
      results={results}
      validationResults={validationResults}
    />
  );
}
