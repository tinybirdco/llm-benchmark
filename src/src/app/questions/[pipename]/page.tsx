"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import benchmarkResults from "../../../../benchmark/results.json";
import { Table } from "../../components/table";
import { Badge } from "../../components/badge";
import { CodePreview } from "../../components/code-preview";

type BenchmarkResult = (typeof benchmarkResults)[number];

type ModelMetric = {
  model: string;
  sql: string;
  executionTime: number;
  timeToFirstToken: number;
  totalDuration: number;
  bytesRead: number;
  rowsRead: number;
  queryLength: number;
  attempts: number;
  success: boolean;
  firstAttempt: boolean;
  tokens: number;
};

function calculateModelMetrics(result: BenchmarkResult): ModelMetric {
  return {
    model: result.model,
    sql: result.sql || "",
    executionTime: result.sqlResult?.executionTime || 0,
    timeToFirstToken: result.metrics?.timeToFirstToken || 0,
    totalDuration: result.metrics?.totalDuration || 0,
    bytesRead: result.sqlResult?.statistics?.bytes_read || 0,
    rowsRead: result.sqlResult?.statistics?.rows_read || 0,
    queryLength: result.sql?.length || 0,
    attempts: result.attempts?.length || 1,
    success: result.sqlResult?.success || false,
    firstAttempt: result.attempts?.length === 1 && result.sqlResult?.success,
    tokens: result.metrics?.tokens?.totalTokens || 0,
  };
}

export default function QuestionDetail() {
  const params = useParams();
  const pipeName = decodeURIComponent(params.pipename as string);

  const modelResults = useMemo(() => {
    const questionResults = benchmarkResults.filter((r) => r.name === pipeName);
    return questionResults.map(calculateModelMetrics);
  }, [pipeName]);

  if (modelResults.length === 0) {
    return (
      <div className="min-h-screen p-8 font-sans">
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
          >
            ← Back to Overview
          </Link>
        </div>
        <div className="text-center text-xl">
          No results found for question: {pipeName}
        </div>
      </div>
    );
  }

  // Get the question details from any result (they're all the same)
  const questionDetails = benchmarkResults.find(
    (r) => r.name === pipeName
  )?.question;

  const columns = [
    {
      name: "Model",
      accessorKey: "model",
      cell: (row: unknown) => {
        const metric = row as ModelMetric;
        return (
          <div className="max-w-[475px]">
            <Link
              href={`/models/${encodeURIComponent(metric.model)}`}
              className="hover:text-[#27F795]"
            >
              <div className="truncate">
                {metric.model}
              </div>
            </Link>
            <CodePreview sql={metric.sql} />
          </div>
        );
      },
    },
    {
      name: "Success",
      accessorKey: "success",
      cell: (row: unknown) => {
        const metric = row as ModelMetric;
        return (
          <Badge status={metric.success ? "success" : "error"}>
            {metric.success ? "Success" : "Failed"}
          </Badge>
        );
      },
    },
    {
      name: "First Attempt",
      accessorKey: "firstAttempt",
      cell: (row: unknown) => {
        const metric = row as ModelMetric;
        return (
          <Badge status={metric.firstAttempt ? "success" : "warning"}>
            {metric.firstAttempt ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      name: "Execution (ms)",
      accessorKey: "executionTime",
      cell: (row: unknown) => (
        <span className="font-mono">
          {((row as ModelMetric).executionTime * 1000).toFixed(2)}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "LLM Gen (s)",
      accessorKey: "totalDuration",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as ModelMetric).totalDuration.toFixed(3)}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Attempts",
      accessorKey: "attempts",
      cell: (row: unknown) => (
        <span className="font-mono">{(row as ModelMetric).attempts}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Rows Read",
      accessorKey: "rowsRead",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as ModelMetric).rowsRead.toLocaleString()}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Query Length",
      accessorKey: "queryLength",
      cell: (row: unknown) => (
        <span className="font-mono">{(row as ModelMetric).queryLength}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Tokens",
      accessorKey: "tokens",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as ModelMetric).tokens.toLocaleString()}
        </span>
      ),
      type: "right" as const,
    },
  ];

  return (
    <div className="min-h-screen p-8 font-sans">
      <div className="mb-8">
        <Link href="/" className="text-white hover:text-[#27F795]">
          ← Back
        </Link>
      </div>

      <h1 className="text-3xl mb-4">Question Details</h1>
      <div className="mb-8 p-4 bg-[#0A0A0A] rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2 text-[#F4F4F4]">
          {questionDetails?.question}
        </h2>
        <pre className="p-4 bg-[#353535] rounded overflow-x-auto">
          <code className="text-[#C6C6C6]">{questionDetails?.content}</code>
        </pre>
      </div>

      <h2 className="text-2xl mb-4">Model Results</h2>
      <div className="overflow-x-auto shadow-lg rounded-lg">
        <Table columns={columns} data={modelResults} />
      </div>
    </div>
  );
}
