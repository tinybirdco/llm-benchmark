"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Table } from "./table";
import { ModelMetrics } from "@/lib/eval";
import { useBenchmarkData } from "@/lib/use-benchmark-data";

const ModelCell = ({ model }: { model: string }) => {
  return (
    <div className="max-w-[475px]">
      <Link
        href={`/models/${encodeURIComponent(model)}`}
        className="text-accent hover:underline hover:underline-offset-2 text-sm"
      >
        <div className="truncate">{model}</div>
      </Link>
    </div>
  );
};

type BenchmarkTableProps = {
  showRelative?: boolean;
  selectedModels?: string[];
  selectedProviders?: string[];
  onModelChange?: (models: string[]) => void;
  onProviderChange?: (providers: string[]) => void;
  onShowRelativeChange?: (checked: boolean) => void;
};

export const BenchmarkTable = ({
  showRelative = false,
  selectedModels = [],
  selectedProviders = [],
  onModelChange,
  onProviderChange,
  onShowRelativeChange,
}: BenchmarkTableProps) => {
  const { modelMetrics, humanMetrics, getFilteredData } = useBenchmarkData();

  const filteredData = useMemo(() => {
    return getFilteredData(selectedModels, selectedProviders);
  }, [getFilteredData, selectedModels, selectedProviders]);

  const columns = [
    {
      name: "Rank",
      accessorKey: "rank",
      sortable: true,
      description: "The ranking of the model based on overall performance",
      cell: (row: ModelMetrics) =>
        row.provider === "human" ? (
          "--"
        ) : (
          <span className="font-mono">#{row.rank}</span>
        ),
      type: "left" as const,
    },
    {
      name: "Provider",
      accessorKey: "provider",
      sortable: true,
      description: "The provider of the model",
      cell: (row: ModelMetrics) => row.provider,
    },
    {
      name: "Model",
      accessorKey: "model",
      sortable: true,
      description: "The name of the model",
      cell: (row: ModelMetrics) =>
        row.provider === "human" ? row.model : <ModelCell model={row.model} />,
    },
    {
      name: "Score",
      accessorKey: "score",
      sortable: true,
      description:
        "Aggregate metric that combines latency, scan size, and success rate.",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") {
          return "--";
        }
        return (
          <div className="inline-flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${row.score > 75
                  ? "bg-[#27F795]"
                  : row.score >= 60
                    ? "bg-[#F7D727]"
                    : "bg-[#F72727]"
                }`}
            />
            <span className="font-mono">{row.score.toFixed(2)}</span>
          </div>
        );
      },
      type: "right" as const,
    },
    {
      name: "Efficiency",
      accessorKey: "efficiencyScore",
      sortable: true,
      description: "How fast the model is at generating valid queries",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") {
          return "--";
        }
        return (
          <div className="inline-flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${row.efficiencyScore > 75
                  ? "bg-[#27F795]"
                  : row.efficiencyScore >= 50
                    ? "bg-[#F7D727]"
                    : "bg-[#F72727]"
                }`}
            />
            <span className="font-mono">{row.efficiencyScore.toFixed(2)}</span>
          </div>
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
              className={`w-2 h-2 rounded-full mr-2 ${row.exactnessScore > 75
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
      name: "LLM Gen Time (s)",
      accessorKey: "avgTotalDuration",
      sortable: true,
      description:
        "Average time for the LLM to generate the SQL query in seconds",
      cell: (row: ModelMetrics) =>
        row.provider === "human" ? (
          "--"
        ) : (
          <span className="font-mono">{row.avgTotalDuration.toFixed(3)}</span>
        ),
      type: "right" as const,
    },
    {
      name: "Avg Attempts",
      accessorKey: "avgAttempts",
      sortable: true,
      description: "Average number of attempts needed per query",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") {
          return "--";
        }
        return <span className="font-mono">{row.avgAttempts.toFixed(2)}</span>;
      },
      type: "right" as const,
    },
    {
      name: "Avg Query Latency",
      accessorKey: "avgExecutionTime",
      sortable: true,
      description: "Average time taken to execute the query in milliseconds",
      cell: (row: ModelMetrics) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
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
              <span className="text-sm text-accent">
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
      name: "Avg Rows Read",
      accessorKey: "avgRowsRead",
      sortable: true,
      description: "Average number of rows read per query (lower is better)",
      cell: (row: ModelMetrics) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
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
              <span className="text-sm text-accent">
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
      name: "Avg Data Read",
      accessorKey: "avgBytesRead",
      sortable: true,
      description: "Average amount of data read per query in MB",
      cell: (row: ModelMetrics) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
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
              <span className="text-sm text-accent">
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
    <div className="overflow-x-auto w-full">
      <Table
        columns={columns}
        data={filteredData}
        defaultSort={{ key: "rank", direction: "asc" }}
      />
    </div>
  );
};
