import {
  fetchResultsForModel,
  TinybirdResult,
} from "@/lib/fetch-benchmark-data";
import { ModelDetailClient } from "./model-detail-client";
import humanResults from "../../../../benchmark/results-human.json";

export const revalidate = 300;

export default async function ModelDetail({
  params,
}: {
  params: Promise<{ modelname: string }>;
}) {
  const { modelname } = await params;
  const modelName = decodeURIComponent(modelname);

  let results: TinybirdResult[];

  if (modelName === "human") {
    results = (humanResults as any[]).map((r) => ({
      sql: r.sql ?? "",
      sql_result_success: r.sqlResult?.success ? 1 : 0,
      sql_result_execution_time: r.sqlResult?.executionTime ?? 0,
      sql_result_error: r.sqlResult?.error ?? "",
      sql_result_query_latency: r.sqlResult?.statistics?.elapsed ?? null,
      sql_result_rows_read: r.sqlResult?.statistics?.rows_read ?? null,
      sql_result_bytes_read: r.sqlResult?.statistics?.bytes_read ?? null,
      name: r.name,
      question: r.question?.content ?? r.question?.question ?? "",
      model: r.model,
      provider: r.provider,
      llm_time_to_first_token: 0,
      llm_total_duration: 0,
      llm_prompt_tokens: 0,
      llm_completion_tokens: 0,
      llm_total_tokens: 0,
      llm_error: "",
      num_attempts: 1,
      first_attempt_success: 1,
    }));
  } else {
    results = await fetchResultsForModel(modelName);
  }

  return <ModelDetailClient modelName={modelName} results={results} />;
}
