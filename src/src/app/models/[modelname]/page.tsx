"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import benchmarkResults from "../../../../benchmark/results.json";
import { Table } from "../../components/table";
import { Badge } from "../../components/badge";
import { CodePreview } from "../../components/code-preview";
import { ArrowLeftIcon } from "@/app/components/icons";

type BenchmarkResult = (typeof benchmarkResults)[number];

type QuestionMetric = {
  name: string;
  question: string;
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

function calculateQuestionMetrics(result: BenchmarkResult): QuestionMetric {
  return {
    name: result.name,
    question: result.question.question,
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

const QuestionCell = ({
  metric,
  isExpanded,
  setIsExpanded,
}: {
  metric: QuestionMetric;
  isExpanded: boolean;
  setIsExpanded: (name: string) => void;
}) => {
  return (
    <div className={`max-w-[475px] -m-4 p-4`}>
      <Link
        href={`/questions/${encodeURIComponent(metric.name)}`}
        className="hover:text-[#27F795] text-sm"
      >
        <div className="truncate" title={metric.question}>
          {metric.question}
        </div>
      </Link>
      <CodePreview
        sql={metric.sql}
        isExpanded={isExpanded}
        onExpandChange={() => setIsExpanded(metric.name)}
      />
    </div>
  );
};

export default function ModelDetail() {
  const params = useParams();
  const modelName = decodeURIComponent(params.modelname as string);

  const questionMetrics = useMemo(() => {
    const modelResults = benchmarkResults.filter((r) => r.model === modelName);
    return modelResults.map(calculateQuestionMetrics);
  }, [modelName]);

  const [expandedQuestions, setExpandedQuestions] = useState<string[]>([]);

  const handleExpandChange = (name: string) => {
    if (expandedQuestions.includes(name)) {
      setExpandedQuestions((prev) => prev.filter((q) => q !== name));
    } else {
      setExpandedQuestions((prev) => [...prev, name]);
    }
  };

  const columns = [
    {
      name: "Question",
      accessorKey: "question",
      cell: (row: unknown) => {
        const metric = row as QuestionMetric;
        return (
          <QuestionCell
            metric={metric}
            isExpanded={expandedQuestions.includes(metric.name)}
            setIsExpanded={handleExpandChange}
          />
        );
      },
    },
    {
      name: "Success",
      accessorKey: "success",
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
      name: "Execution (ms)",
      accessorKey: "executionTime",
      cell: (row: unknown) => (
        <span className="font-mono">
          {((row as QuestionMetric).executionTime * 1000).toFixed(2)}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "LLM Gen (s)",
      accessorKey: "totalDuration",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as QuestionMetric).totalDuration.toFixed(3)}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Attempts",
      accessorKey: "attempts",
      cell: (row: unknown) => (
        <span className="font-mono">{(row as QuestionMetric).attempts}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Rows Read",
      accessorKey: "rowsRead",
      cell: (row: unknown) => (
        <span className="font-mono">
          {(row as QuestionMetric).rowsRead.toLocaleString()}
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Query Length",
      accessorKey: "queryLength",
      cell: (row: unknown) => (
        <span className="font-mono">{(row as QuestionMetric).queryLength}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Tokens",
      accessorKey: "tokens",
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
    <div className="min-h-screen p-8 font-sans">
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

      <div className="overflow-x-auto shadow-lg rounded-lg">
        <Table
          columns={columns}
          data={questionMetrics.map((metric) => ({
            key: metric.name,
            ...metric,
          }))}
          expandedRows={expandedQuestions}
        />
      </div>
    </div>
  );
}
