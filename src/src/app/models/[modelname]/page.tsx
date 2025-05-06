"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import benchmarkResults from "../../../../benchmark/results.json";
import humanResults from "../../../../benchmark/results-human.json";
import { Table } from "../../components/table";
import { Badge } from "../../components/badge";
import { ArrowLeftIcon } from "@/app/components/icons";
import { PreviewModal } from "@/app/components/code-preview";

const typedBenchmarkResults = benchmarkResults as any[];
type BenchmarkResult = (typeof typedBenchmarkResults)[number];

type QuestionMetric = {
  name: string;
  model: string;
  question: string;
  sql: string;
  executionTime: number;
  timeToFirstToken: number;
  totalDuration: number;
  bytesRead: number;
  rowsRead: number;
  queryLength: number;
  attempts: Array<{ question: { question: string } }>;
  success: boolean;
  firstAttempt: boolean;
  tokens: number;
};

function calculateQuestionMetrics(result: BenchmarkResult): QuestionMetric {
  return {
    name: result.name,
    model: result.model,
    question: result.question.question,
    sql: result.sql || "",
    executionTime: result.sqlResult?.executionTime || 0,
    timeToFirstToken: result.metrics?.timeToFirstToken || 0,
    totalDuration: result.metrics?.totalDuration || 0,
    bytesRead: result.sqlResult?.statistics?.bytes_read || 0,
    rowsRead: result.sqlResult?.statistics?.rows_read || 0,
    queryLength: result.sql?.length || 0,
    attempts: result.attempts?.map((a: any) => ({
      question: { question: a.question.question },
    })) || [{ question: { question: "" } }],
    success: result.sqlResult?.success || false,
    firstAttempt:
      result.model === "human"
        ? true
        : result.attempts?.length === 1 && result.sqlResult?.success,
    tokens: result.metrics?.tokens?.totalTokens || 0,
  };
}

const QuestionCell = ({ metric }: { metric: QuestionMetric }) => {
  const question = metric.attempts?.[0]?.question?.question || metric.question;

  return (
    <div className={`max-w-[475px] -m-4 p-4`}>
      <div className="truncate" title={question}>
        {question}
      </div>

      <PreviewModal metric={metric as any} />
    </div>
  );
};

export default function ModelDetail() {
  const params = useParams();
  const modelName = decodeURIComponent(params.modelname as string);

  const questionMetrics = useMemo(() => {
    let modelResults;
    if (modelName === "human") {
      modelResults = (humanResults as any[]).filter((r) => r.model === "human");
    } else {
      modelResults = typedBenchmarkResults.filter((r) => r.model === modelName);
    }
    return modelResults.map(calculateQuestionMetrics);
  }, [modelName]);

  const columns = [
    {
      name: "Question",
      accessorKey: "question",
      sortable: true,
      description: "The question that was asked to the model",
      cell: (row: unknown) => {
        const metric = row as QuestionMetric;
        return <QuestionCell metric={metric} />;
      },
    },
    {
      name: "Success",
      accessorKey: "success",
      sortable: true,
      description: "Whether the query executed successfully",
      cell: (row: unknown) => {
        const metric = row as QuestionMetric;
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
      sortable: true,
      description: "Whether the query succeeded on the first try",
      cell: (row: unknown) => {
        const metric = row as QuestionMetric;
        return (
          <Badge status={metric.firstAttempt ? "success" : "warning"}>
            {metric.firstAttempt ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      name: "Query Latency",
      accessorKey: "executionTime",
      sortable: true,
      description: "Time taken to execute the query in milliseconds",
      cell: (row: unknown) => (
        <span className="font-mono">
          {((row as QuestionMetric).executionTime * 1000).toLocaleString()} ms
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "LLM Gen",
      accessorKey: "totalDuration",
      sortable: true,
      description: "Time for the LLM to generate the SQL query in seconds",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as QuestionMetric).totalDuration.toLocaleString()} s
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Attempts",
      accessorKey: "attempts",
      sortable: true,
      description: "Number of attempts needed for this query",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as QuestionMetric).attempts.length}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Rows Read",
      accessorKey: "rowsRead",
      sortable: true,
      description: "Number of rows read by this query (lower is better)",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as QuestionMetric).rowsRead.toLocaleString()}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Data Read",
      accessorKey: "bytesRead",
      sortable: true,
      description: "Amount of data read by this query in MB",
      cell: (row: unknown) => (
        <span className="font-mono">
          {((row as QuestionMetric).bytesRead / (1024 * 1024)).toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}{" "}
          MB
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Query Length",
      accessorKey: "queryLength",
      sortable: true,
      description: "Length of the generated SQL query in characters",
      cell: (row: unknown) => (
        <span className="font-mono">{(row as QuestionMetric).queryLength}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Tokens",
      accessorKey: "tokens",
      sortable: true,
      description: "Number of tokens used to generate the query",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as QuestionMetric).tokens.toLocaleString()}
        </span>
      ),
      type: "right" as const,
    },
  ];

  if (questionMetrics.length === 0) {
    return (
      <div className="min-h-screen p-8 font-sans">
        <div className="mb-8">
          <Link
            href="/"
            className="text-white hover:text-[#27F795] flex items-center gap-2"
          >
            <ArrowLeftIcon /> Back
          </Link>
        </div>
        <div className="text-center text-xl">
          No results found for model: {modelName}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 lg:px-8 font-sans">
      <div className="mb-8">
        <Link
          href="/"
          className="text-white hover:text-[#27F795] flex items-center gap-2"
        >
          <ArrowLeftIcon /> Back
        </Link>
      </div>

      <h1 className="text-3xl mb-8">
        Detailed Results for <span className="text-[#27F795]">{modelName}</span>
      </h1>

      <div className="overflow-x-auto">
        <Table
          columns={columns}
          data={questionMetrics as any[]}
          defaultSort={{
            key: "question",
            direction: "asc",
          }}
        />
      </div>
    </div>
  );
}
