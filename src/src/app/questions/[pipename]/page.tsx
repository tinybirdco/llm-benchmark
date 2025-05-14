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
import { getExactnessScore, ModelMetrics } from "@/lib/eval";
import { cn } from "@/lib/utils";

const typedBenchmarkResults = benchmarkResults as any[];
const typedHumanResults = humanResults as any[];

type BenchmarkResult = (typeof typedBenchmarkResults)[number];
type HumanResult = (typeof typedHumanResults)[number];

function calculateModelMetrics(
  result: BenchmarkResult | HumanResult
): ModelMetrics {
  return {
    model: result.model,
    provider: result.provider,
    name: result.name,
    totalQueries: 1,
    successfulQueries: result.sqlResult?.success ? 1 : 0,
    firstAttemptSuccess:
      result.model === "human" ||
      (result.sqlResult?.success && result.attempts?.length === 1)
        ? 1
        : 0,
    avgExecutionTime: result.sqlResult?.executionTime || 0,
    avgTimeToFirstToken:
      "metrics" in result ? result.metrics?.timeToFirstToken || 0 : 0,
    avgTotalDuration:
      "metrics" in result ? result.metrics?.totalDuration || 0 : 0,
    totalBytesRead: result.sqlResult?.statistics?.bytes_read || 0,
    totalRowsRead: result.sqlResult?.statistics?.rows_read || 0,
    avgRowsRead: result.sqlResult?.statistics?.rows_read || 0,
    avgBytesRead: result.sqlResult?.statistics?.bytes_read || 0,
    avgQueryLength: result.sql?.length || 0,
    avgTokens:
      "metrics" in result ? result.metrics?.tokens?.totalTokens || 0 : 0,
    avgAttempts: result.attempts?.length || 1,
    successRate: result.sqlResult?.success ? 100 : 0,
    firstAttemptRate:
      result.model === "human" ||
      (result.sqlResult?.success && result.attempts?.length === 1)
        ? 100
        : 0,
    efficiencyScore: 0,
    rawEfficiencyScore: 0,
    exactnessScore: getExactnessScore(
      result.provider,
      result.model,
      result.question.name
    ),
    score: 0,
    rank: 0,
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

export default function QuestionDetail() {
  const params = useParams();
  const pipeName = decodeURIComponent(params.pipename as string);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showRelative, setShowRelative] = useState(false);

  const modelResults = useMemo(() => {
    const questionResults = typedBenchmarkResults.filter(
      (r) => r.name === pipeName
    );
    const humanQuestionResults = typedHumanResults.filter(
      (r) => r.name === pipeName
    );
    return [
      ...humanQuestionResults.map(calculateModelMetrics),
      ...questionResults.map(calculateModelMetrics),
    ];
  }, [pipeName]);

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

  // Find the human baseline for this question
  const humanBaseline = useMemo(
    () => modelResults.find((m) => m.provider === "human"),
    [modelResults]
  );

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
  const questionDetails = typedBenchmarkResults.find((r) => r.name === pipeName)
    ?.attempts?.[0]?.question;

  const columns = [
    {
      name: "Model",
      accessorKey: "model",
      sortable: true,
      description: "The name of the model that generated the query",
      cell: (row: ModelMetrics) => {
        return (
          <div>
            <ModelCell metric={row} />
            <PreviewModal metric={row} />
          </div>
        );
      },
    },
    {
      name: "Valid Query",
      accessorKey: "successRate",
      sortable: true,
      description: "Whether the query executed successfully",
      cell: (row: ModelMetrics) => {
        return (
          <Badge status={row.successRate === 100 ? "success" : "error"}>
            {row.successRate === 100 ? "Success" : "Failed"}
          </Badge>
        );
      },
      type: "right" as const,
    },
    {
      name: "First Attempt",
      accessorKey: "firstAttemptRate",
      sortable: true,
      description: "Whether the query succeeded on the first try",
      cell: (row: ModelMetrics) => {
        return (
          <Badge status={row.firstAttemptRate === 100 ? "success" : "warning"}>
            {row.firstAttemptRate === 100 ? "Yes" : "No"}
          </Badge>
        );
      },
      type: "right" as const,
    },
    {
      name: "Exactness",
      accessorKey: "exactnessScore",
      sortable: true,
      description: "How similar the model's output is to the human's output",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") {
          return "--";
        }
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
                {(row.avgExecutionTime * 1000).toLocaleString()} ms
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {(row.avgExecutionTime * 1000).toLocaleString()} ms
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
          {row.avgTotalDuration.toLocaleString()} s
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
                {Math.round(row.avgRowsRead).toLocaleString()}
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {Math.round(row.avgRowsRead).toLocaleString()}
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
        <span className="font-mono">{row.avgTokens.toLocaleString()}</span>
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
                {(row.avgBytesRead / (1024 * 1024)).toLocaleString(undefined, {
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
            {(row.avgBytesRead / (1024 * 1024)).toLocaleString(undefined, {
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
        Model Results for &quot;{questionDetails?.question}&quot;
      </h2>

      <div className="mb-8 space-y-5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-[#27F795] hover:text-[#1ac177] whitespace-nowrap flex items-center gap-1"
        >
          Show human code
            <ChevronDownIcon className={cn(isExpanded ? "rotate-180" : "", "transition-transform duration-200")} />
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
