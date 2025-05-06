"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import benchmarkResults from "../../../../benchmark/results.json";
import humanResults from "../../../../benchmark/results-human.json";
import { Table } from "../../components/table";
import { Badge } from "../../components/badge";
import { ArrowLeftIcon, ChevronDownIcon } from "@/app/components/icons";
import { Header } from "@/app/components/nav";
import { PreviewModal } from "@/app/components/code-preview";

type BenchmarkResult = (typeof benchmarkResults)[number];
type HumanResult = (typeof humanResults)[number];

export type ModelMetric = {
  model: string;
  name: string;
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

function calculateModelMetrics(result: BenchmarkResult | HumanResult): ModelMetric {
  return {
    model: result.model,
    name: result.question.name,
    sql: result.sql || "",
    executionTime: result.sqlResult?.executionTime || 0,
    timeToFirstToken: 'metrics' in result ? result.metrics?.timeToFirstToken || 0 : 0,
    totalDuration: 'metrics' in result ? result.metrics?.totalDuration || 0 : 0,
    bytesRead: result.sqlResult?.statistics?.bytes_read || 0,
    rowsRead: result.sqlResult?.statistics?.rows_read || 0,
    queryLength: result.sql?.length || 0,
    attempts: result.attempts?.length || 1,
    success: result.sqlResult?.success || false,
    firstAttempt: result.model === "human" ? true : result.attempts?.length === 1 && result.sqlResult?.success,
    tokens: 'metrics' in result ? result.metrics?.tokens?.totalTokens || 0 : 0,
  };
}

const ModelCell = ({ metric }: { metric: ModelMetric }) => {
  if (metric.model === "human") {
    return (
      <div className={`text-sm text-secondary`}>
        <div className="truncate">{metric.model}</div>
      </div>
    );
  }

  return (
    <div className={`max-w-[475px] -m-4 p-4`}>
      <Link
        href={`/models/${encodeURIComponent(metric.model)}`}
        className="text-[#27F795] text-sm"
      >
        <div className="truncate">{metric.model}</div>
      </Link>
    </div>
  );
};

export default function QuestionDetail() {
  const params = useParams();
  const pipeName = decodeURIComponent(params.pipename as string);

  const modelResults = useMemo(() => {
    const questionResults = benchmarkResults.filter((r) => r.name === pipeName);
    const humanQuestionResults = humanResults.filter((r) => r.name === pipeName);
    return [
      ...humanQuestionResults.map(calculateModelMetrics),
      ...questionResults.map(calculateModelMetrics),
    ];
  }, [pipeName]);

  const [isExpanded, setIsExpanded] = useState(false);

  if (modelResults.length === 0) {
    return (
      <div className="min-h-screen p-8 font-sans">
        <div className="mb-8">
          <Link
            href="/"
            className="text-white hover:text-[#27F795] flex items-center gap-2"
          >
            <ArrowLeftIcon />
            Back
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
      sortable: true,
      description: "The name of the model that generated the query",
      cell: (row: unknown) => {
        const metric = row as ModelMetric;
        return (
          <div>
            <ModelCell metric={metric} />
            <PreviewModal metric={metric}  />
          </div>
        );
      },
    },
    {
      name: "Success",
      accessorKey: "success",
      sortable: true,
      description: "Whether the query executed successfully",
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
      sortable: true,
      description: "Whether the query succeeded on the first try",
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
      sortable: true,
      description: "Time taken to execute the query in milliseconds",
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
      sortable: true,
      description: "Time for the LLM to generate the SQL query in seconds",
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
      sortable: true,
      description: "Number of attempts needed for this query",
      cell: (row: unknown) => (
        <span className="font-mono">{(row as ModelMetric).attempts}</span>
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
          {(row as ModelMetric).rowsRead.toLocaleString()}
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
        <span className="font-mono">{(row as ModelMetric).queryLength}</span>
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
          {(row as ModelMetric).tokens.toLocaleString()}
        </span>
      ),
      type: "right" as const,
    },
  ];

  return (
    <div className="min-h-screen p-8 font-sans">
      <Header />

      <div className="mb-8 space-y-5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-[#27F795] hover:text-[#1ac177] whitespace-nowrap flex items-center gap-1"
        >
          Show human code
          <ChevronDownIcon />
        </button>

        {isExpanded ? (
          <div>
            <pre className="p-4 bg-[#353535] rounded overflow-x-auto max-w-[1400px]">
              <code className="text-white text-sm">
                {questionDetails?.content}
              </code>
            </pre>
          </div>
        ) : null}
      </div>

      <h2 className="text-2xl mb-4">Model Results</h2>

      <div className="overflow-x-auto">
        <Table
          columns={columns}
          data={modelResults.map((metric) => ({
            key: metric.model,
            ...metric,
          }))}
        />
      </div>
    </div>
  );
}
