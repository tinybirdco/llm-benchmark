import {
  fetchResultsForQuestion,
  fetchValidationForQuestion,
} from "@/lib/fetch-benchmark-data";
import { QuestionDetailClient } from "./question-detail-client";

export const revalidate = 300;

export default async function QuestionDetail({
  params,
}: {
  params: Promise<{ pipename: string }>;
}) {
  const { pipename } = await params;
  const pipeName = decodeURIComponent(pipename);

  const [results, validationResults] = await Promise.all([
    fetchResultsForQuestion(pipeName),
    fetchValidationForQuestion(pipeName),
  ]);

  return (
    <QuestionDetailClient
      pipeName={pipeName}
      results={results}
      validationResults={validationResults}
    />
  );
}
