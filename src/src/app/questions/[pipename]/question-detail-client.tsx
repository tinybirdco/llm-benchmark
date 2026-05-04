"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Table } from "../../components/table";
import { Badge } from "../../components/badge";
import { ArrowLeftIcon, ChevronDownIcon } from "@/app/components/icons";
import { Header } from "@/app/components/nav";
import { PreviewModal } from "@/app/components/code-preview";
import { getExactnessScore, ModelMetrics } from "@/lib/eval";
import { cn } from "@/lib/utils";
import { TinybirdResult } from "@/lib/fetch-benchmark-data";

type ExtendedModelMetrics = ModelMetrics & {
  sql?: string;
  question?: string;
  sqlError?: string;
};

function toModelMetrics(r: TinybirdResult): ExtendedModelMetrics {
  return {
    model: r.model,
    provider: r.provider,
    name: r.name,
    totalQueries: 1,
    successfulQueries: r.sql_result_success ? 1 : 0,
    firstAttemptSuccess: r.first_attempt_success ? 1 : 0,
    avgExecutionTime: r.sql_result_execution_time,
    avgTimeToFirstToken: r.llm_time_to_first_token,
    avgTotalDuration: r.llm_total_duration,
    totalBytesRead: r.sql_result_bytes_read || 0,
    totalRowsRead: r.sql_result_rows_read || 0,
    avgRowsRead: r.sql_result_rows_read || 0,
    avgBytesRead: r.sql_result_bytes_read || 0,
    avgQueryLength: r.sql?.length || 0,
    avgTokens: r.llm_total_tokens,
    avgAttempts: r.num_attempts,
    successRate: r.sql_result_success ? 100 : 0,
    firstAttemptRate: r.first_attempt_success ? 100 : 0,
    efficiencyScore: 0,
    rawEfficiencyScore: 0,
    exactnessScore: getExactnessScore(r.provider, r.model, r.name),
    score: 0,
    rank: 0,
    sql: r.sql,
    question: r.question,
    sqlError: r.sql_result_error || undefined,
  };
}

const ModelCell = ({ metric }: { metric: ModelMetrics }) => {
  if (metric.model === "human") {
    return (
      <div className={`text-sm text-secondary`}>
        <div className="truncate">{metric.model}</div>
      </div>
    );
  }

  return (
    <div className={`max-w-[475px] -m-4 p-4`}>
      <div className="truncate">{metric.model}</div>
    </div>
  );
};

export function QuestionDetailClient({
  pipeName,
  results,
}: {
  pipeName: string;
  results: TinybirdResult[];
}) {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showRelative, setShowRelative] = useState(false);

  const modelResults = useMemo(
    () => results.map(toModelMetrics),
    [results]
  );

  const filteredData = useMemo(() => {
    return modelResults.filter((result) => {
      const modelMatch =
        selectedModels.length === 0 || selectedModels.includes(result.model);
      const providerMatch =
        selectedProviders.length === 0 ||
        selectedProviders.includes(result.provider);
      return modelMatch && providerMatch;
    });
  }, [modelResults, selectedModels, selectedProviders]);

  const humanBaseline = useMemo(
    () => modelResults.find((m) => m.provider === "human"),
    [modelResults]
  );

  const [isExpanded, setIsExpanded] = useState(false);

  const questionText = results[0]?.question ?? "";

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

  const columns = [
    {
      name: "Model",
      accessorKey: "model",
      sortable: true,
      description: "The name of the model that generated the query",
      cell: (row: ModelMetrics) => (
        <div>
          <ModelCell metric={row} />
          <PreviewModal metric={row} />
        </div>
      ),
    },
    {
      name: "Valid Query",
      accessorKey: "successRate",
      sortable: true,
      description: "Whether the query executed successfully",
      cell: (row: ModelMetrics) => (
        <Badge status={row.successRate === 100 ? "success" : "error"}>
          {row.successRate === 100 ? "Success" : "Failed"}
        </Badge>
      ),
      type: "right" as const,
    },
    {
      name: "First Attempt",
      accessorKey: "firstAttemptRate",
      sortable: true,
      description: "Whether the query succeeded on the first try",
      cell: (row: ModelMetrics) => (
        <Badge status={row.firstAttemptRate === 100 ? "success" : "warning"}>
          {row.firstAttemptRate === 100 ? "Yes" : "No"}
        </Badge>
      ),
      type: "right" as const,
    },
    {
      name: "Exactness",
      accessorKey: "exactnessScore",
      sortable: true,
      description: "How similar the model's output is to the human's output",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") return "--";
        return (
          <div className="inline-flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                row.exactnessScore > 75
                  ? "bg-[#27F795]"
                  : row.exactnessScore >= 50
                  ? "bg-[#F7D727]"
                  : "bg-[#F72727]"
              }`}
            />
            <span className="font-mono">{row.exactnessScore.toFixed(2)}</span>
          </div>
        );
      },
      type: "right" as const,
    },
    {
      name: "Avg Query Latency",
      accessorKey: "avgExecutionTime",
      sortable: true,
      description: "Average time taken to execute the query in milliseconds",
      cell: (row: ModelMetrics) => {
        const showPercentage =
          showRelative && row.provider !== "human" && humanBaseline;
        if (showPercentage) {
          const percentage =
            ((row.avgExecutionTime * 1000) /
              (humanBaseline.avgExecutionTime * 1000)) *
            100;
          return (
            <div className="space-x-2">
              <span className="font-mono">
                {(row.avgExecutionTime * 1000).toLocaleString("en-US")} ms
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {(row.avgExecutionTime * 1000).toLocaleString("en-US")} ms
          </span>
        );
      },
      type: "right" as const,
    },
    {
      name: "LLM Gen",
      accessorKey: "avgTotalDuration",
      sortable: true,
      description: "Time for the LLM to generate the SQL query in seconds",
      cell: (row: ModelMetrics) => (
        <span className="font-mono">
          {row.avgTotalDuration.toLocaleString("en-US")} s
        </span>
      ),
      type: "right" as const,
    },
    {
      name: "Attempts",
      accessorKey: "avgAttempts",
      sortable: true,
      description: "Number of attempts needed for this query",
      cell: (row: ModelMetrics) => (
        <span className="font-mono">{row.avgAttempts}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Avg Rows Read",
      accessorKey: "avgRowsRead",
      sortable: true,
      description: "Average number of rows read per query (lower is better)",
      cell: (row: ModelMetrics) => {
        const showPercentage =
          showRelative && row.provider !== "human" && humanBaseline;
        if (showPercentage) {
          const percentage =
            (row.avgRowsRead / humanBaseline.avgRowsRead) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">
                {Math.round(row.avgRowsRead).toLocaleString("en-US")}
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {Math.round(row.avgRowsRead).toLocaleString("en-US")}
          </span>
        );
      },
      type: "right" as const,
    },
    {
      name: "Query Length",
      accessorKey: "avgQueryLength",
      sortable: true,
      description: "Length of the generated SQL query in characters",
      cell: (row: ModelMetrics) => (
        <span className="font-mono">{row.avgQueryLength}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Tokens",
      accessorKey: "avgTokens",
      sortable: true,
      description: "Number of tokens used to generate the query",
      cell: (row: ModelMetrics) => (
        <span className="font-mono">{row.avgTokens.toLocaleString("en-US")}</span>
      ),
      type: "right" as const,
    },
    {
      name: "Avg Data Read",
      accessorKey: "avgBytesRead",
      sortable: true,
      description: "Average amount of data read per query in MB",
      cell: (row: ModelMetrics) => {
        const showPercentage =
          showRelative && row.provider !== "human" && humanBaseline;
        if (showPercentage) {
          const percentage =
            (row.avgBytesRead / humanBaseline.avgBytesRead) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">
                {(row.avgBytesRead / (1024 * 1024)).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                MB
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {(row.avgBytesRead / (1024 * 1024)).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            MB
          </span>
        );
      },
      type: "right" as const,
    },
  ];

  return (
    <div className="min-h-screen py-8 px-4 lg:px-8 font-sans">
      <Header
        data={modelResults}
        selectedModels={selectedModels}
        selectedProviders={selectedProviders}
        onModelChange={setSelectedModels}
        onProviderChange={setSelectedProviders}
        showRelative={showRelative}
        onShowRelativeChange={setShowRelative}
      />
      <h2 className="text-xl mb-4">
        Model Results for &quot;{questionText}&quot;
      </h2>

      <div className="mb-8 space-y-5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-[#27F795] hover:text-[#1ac177] whitespace-nowrap flex items-center gap-1"
        >
          Show human code
          <ChevronDownIcon
            className={cn(
              isExpanded ? "rotate-180" : "",
              "transition-transform duration-200"
            )}
          />
        </button>

        {isExpanded ? (
          <div>
            <pre className="p-4 bg-[#353535] rounded overflow-x-auto max-w-[1400px]">
              <code className="text-white text-sm">{questionText}</code>
            </pre>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto w-full">
        <Table
          columns={columns}
          data={filteredData}
          defaultSort={{ key: "rank", direction: "asc" }}
        />
      </div>
    </div>
  );
}
