"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import humanResults from "../../benchmark/results-human.json";

import { Header } from "./components/nav";
import { ProgressBar } from "./components/progress";
import { Table } from "./components/table";
import { calculateModelMetrics, calculateRanks, ModelMetrics } from "@/lib/eval";
import { useResults } from "@/lib/use-results";

type HumanResult = (typeof humanResults)[number];
type ModelResult = ReturnType<typeof useResults>[number];

const ModelCell = ({ model }: { model: string }) => {
  return (
    <div className="max-w-[475px]">
      <Link
        href={`/models/${encodeURIComponent(model)}`}
        className="text-[#27F795] text-sm"
      >
        <div className="truncate">{model}</div>
      </Link>
    </div>
  );
};

export default function Home() {
  const results = useResults();
  const [showRelative, setShowRelative] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  const modelMetrics = useMemo(() => {
    const modelGroups = results.reduce(
      (acc: Record<string, ModelResult[]>, result: ModelResult) => {
        const key = result.model;
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      },
      {}
    );

    return calculateRanks(
      Object.values(modelGroups).map((group) => calculateModelMetrics(group))
    );
  }, [results]);

  const humanMetrics = useMemo(() => {
    const modelGroups = humanResults.reduce(
      (acc: Record<string, HumanResult[]>, result: HumanResult) => {
        const key = result.model;
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      },
      {}
    );

    return Object.values(modelGroups).map((group) => calculateModelMetrics(group));
  }, []);

  const filteredData = useMemo(() => {
    const allData = [...humanMetrics, ...modelMetrics];
    return allData.filter((item) => {
      const modelMatch = selectedModels.length === 0 || selectedModels.includes(item.model);
      const providerMatch = selectedProviders.length === 0 || selectedProviders.includes(item.provider);
      return modelMatch && providerMatch;
    });
  }, [humanMetrics, modelMetrics, selectedModels, selectedProviders]);

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
        row.provider === "human" ? (
          row.model
        ) : (
          <ModelCell model={row.model} />
        ),
    },
    {
      name: "Score",
      accessorKey: "efficiencyScore",
      sortable: true,
      description:
        "Aggregate metric that combines latency, scan size, and success rate.",
      className: "bg-[#FFFFFF]/5",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") {
          return "--";
        }
        return (
          <div className="inline-flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${row.efficiencyScore > 75
                ? "bg-[#27F795]"
                : row.efficiencyScore > 50
                  ? "bg-[#F7D727]"
                  : "bg-[#F72727]"
                }`}
            />
            <span className="font-mono">
              {row.efficiencyScore.toFixed(2)}
            </span>
          </div>
        );
      },
      type: "right" as const,
    },
    {
      name: "Success Rate",
      accessorKey: "successRate",
      sortable: true,
      description: "Percentage of queries that executed successfully",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") {
          return "--";
        }
        return (
          <div className="flex items-center">
            <ProgressBar
              progress={row.successRate}
            />
            <span className="font-mono">
              {row.successRate.toFixed(1)}
            </span>
          </div>
        );
      },
    },
    {
      name: "First Attempt Rate",
      accessorKey: "firstAttemptRate",
      sortable: true,
      description: "Percentage of queries that succeeded on the first try",
      cell: (row: ModelMetrics) => {
        if (row.provider === "human") {
          return "--";
        }
        return (
          <div className="flex items-center">
            <ProgressBar progress={row.firstAttemptRate} />
            <span className="font-mono">
              {row.firstAttemptRate.toFixed(1)}%
            </span>
          </div>
        );
      },
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
          <span className="font-mono">
            {row.avgTotalDuration.toFixed(3)}
          </span>
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
        return (
          <span className="font-mono">
            {row.avgAttempts.toFixed(2)}
          </span>
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
                {(row.avgBytesRead / (1024 * 1024)).toLocaleString(
                  undefined,
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}{" "}
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
            {(row.avgBytesRead / (1024 * 1024)).toLocaleString(
              undefined,
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}{" "}
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
        data={[...humanMetrics, ...modelMetrics]}
        selectedModels={selectedModels}
        selectedProviders={selectedProviders}
        onModelChange={setSelectedModels}
        onProviderChange={setSelectedProviders}
      />

      <div className="mb-4 flex items-center justify-between">
        <label className="inline-flex items-center cursor-pointer">
          <span className="custom-checkbox">
            <input
              type="checkbox"
              checked={showRelative}
              onChange={(e) => setShowRelative(e.target.checked)}
            />
            <span className="custom-checkbox-box">
              <svg
                className="checkmark"
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <path
                  d="M4 8.5L7 11.5L12 5.5"
                  stroke="#222"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>
          <span className="ml-2 text-sm text-[#F4F4F4]">
            Show metrics relative to human baseline
          </span>
        </label>
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
