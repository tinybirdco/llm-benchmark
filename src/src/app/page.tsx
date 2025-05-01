"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import benchmarkResults from "../../benchmark/results.json";
import humanResults from "../../benchmark/results-human.json";
import { Table } from "./components/table";
import { ProgressBar } from "./components/progress";
import { CodePreview } from "./components/code-preview";

type BenchmarkResults = typeof benchmarkResults;
type ModelResult = BenchmarkResults[number];
type HumanResult = (typeof humanResults)[number];

function calculateModelMetrics(modelResults: typeof benchmarkResults) {
  const totalQueries = modelResults.length;
  const successfulQueries = modelResults.filter(
    (r) => r.sqlResult?.success
  ).length;
  const firstAttemptSuccess = modelResults.filter(
    (r) => r.sqlResult?.success && r.attempts.length === 1
  ).length;

  const avgExecutionTime =
    modelResults.reduce(
      (acc, r) => acc + (r.sqlResult?.executionTime || 0),
      0
    ) / totalQueries;
  const avgTimeToFirstToken =
    modelResults.reduce(
      (acc, r) => acc + (r.metrics?.timeToFirstToken || 0),
      0
    ) / totalQueries;
  const avgTotalDuration =
    modelResults.reduce((acc, r) => acc + (r.metrics?.totalDuration || 0), 0) /
    totalQueries;

  const totalBytesRead = modelResults.reduce(
    (acc, r) => acc + (r.sqlResult?.statistics?.bytes_read || 0),
    0
  );
  const totalRowsRead = modelResults.reduce(
    (acc, r) => acc + (r.sqlResult?.statistics?.rows_read || 0),
    0
  );
  const avgRowsRead = totalRowsRead / totalQueries;

  const avgQueryLength =
    modelResults.reduce((acc, r) => acc + (r.sql?.length || 0), 0) /
    totalQueries;
  const avgTokens =
    modelResults.reduce(
      (acc, r) => acc + (r.metrics?.tokens?.totalTokens || 0),
      0
    ) / totalQueries;
  const avgAttempts =
    modelResults.reduce((acc, r) => acc + (r.attempts?.length || 1), 0) /
    totalQueries;

  const successRate = (successfulQueries / totalQueries) * 100;
  const firstAttemptRate = (firstAttemptSuccess / totalQueries) * 100;

  // Efficiency score (lower is better) - custom metric combining execution time, data read, and success rate
  const efficiencyScore =
    (avgExecutionTime * 1000 + totalBytesRead / 1000000) / (successRate + 1);

  return {
    model: modelResults[0].model,
    provider: modelResults[0].provider,
    totalQueries,
    successfulQueries,
    firstAttemptSuccess,
    avgExecutionTime,
    avgTimeToFirstToken,
    avgTotalDuration,
    totalBytesRead,
    totalRowsRead,
    avgRowsRead,
    avgQueryLength,
    avgTokens,
    avgAttempts,
    successRate,
    firstAttemptRate,
    efficiencyScore,
  };
}

const ModelCell = ({ model, sql }: { model: string; sql: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Add the expanded state to the row data
  const row = { model, sql, isExpanded };
  
  return (
    <div className="max-w-[475px]">
      <Link 
        href={`/models/${encodeURIComponent(model)}`}
        className="hover:text-[#27F795] text-sm"
      >
        <div className="truncate">
          {model}
        </div>
      </Link>
      <CodePreview sql={sql} onExpandChange={setIsExpanded} />
    </div>
  );
};

export default function Home() {
  const [showRelative, setShowRelative] = useState(false);

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

    return Object.values(modelGroups).map((group) =>
      calculateModelMetrics(group as ModelResult[])
    );
  }, []);

  const modelMetrics = useMemo(() => {
    const modelGroups = benchmarkResults.reduce(
      (acc: Record<string, ModelResult[]>, result: ModelResult) => {
        const key = result.model;
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      },
      {}
    );

    return Object.values(modelGroups).map((group) =>
      calculateModelMetrics(group as ModelResult[])
    );
  }, []);

  const columns = [
    {
      name: "Model",
      accessorKey: "model",
      cell: (row: any) => row.provider === "human" ? row.model : (
        <ModelCell model={row.model} sql={row.sql || ''} />
      ),
    },
    {
      name: "Provider",
      accessorKey: "provider",
      cell: (row: any) => row.provider,
    },
    {
      name: "Success Rate",
      accessorKey: "successRate",
      cell: (row: any) => (
        <div className="flex items-center">
          <ProgressBar progress={row.successRate} />
          <span className="font-mono">{row.successRate.toFixed(1)}</span>
        </div>
      ),
    },
    {
      name: "First Attempt Rate",
      accessorKey: "firstAttemptRate",
      cell: (row: any) => {
        if (row.provider === "human") {
          return "--";
        }

        return (
          <div className="flex items-center">
            <ProgressBar progress={row.firstAttemptRate} />
            <span className="font-mono">{row.firstAttemptRate.toFixed(1)}%</span>
          </div>
        );
      },
    },
    {
      name: "Avg Execution (ms)",
      accessorKey: "avgExecutionTime",
      cell: (row: any) => {
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
              <span className="font-mono">{(row.avgExecutionTime * 1000).toFixed(2)}</span>
              <span className="text-sm text-[#C6C6C6]">{percentage.toFixed(0)}%</span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {(row.avgExecutionTime * 1000).toFixed(2)}
          </span>
        );
      },
      type: "right",
    },
    {
      name: "LLM Gen Time (s)",
      accessorKey: "avgTotalDuration",
      cell: (row: any) =>
        row.provider === "human" ? (
          "--"
        ) : (
          <span className="font-mono">{row.avgTotalDuration.toFixed(3)}</span>
        ),
      type: "right",
    },
    {
      name: "Avg Attempts",
      accessorKey: "avgAttempts",
      cell: (row: any) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && row.provider !== "human" && humanBaseline;

        if (showPercentage) {
          const percentage =
            (row.avgAttempts / humanBaseline.avgAttempts) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">{row.avgAttempts.toFixed(2)}</span>
              <span className="text-sm text-[#C6C6C6]">{percentage.toFixed(0)}%</span>
            </div>
          );
        }
        return <span className="font-mono">{row.avgAttempts.toFixed(2)}</span>;
      },
      type: "right",
    },
    {
      name: "Avg Rows Read",
      accessorKey: "avgRowsRead",
      cell: (row: any) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && row.provider !== "human" && humanBaseline;

        if (showPercentage) {
          const percentage =
            (row.avgRowsRead / humanBaseline.avgRowsRead) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">{Math.round(row.avgRowsRead).toLocaleString()}</span>
              <span className="text-sm text-[#C6C6C6]">{percentage.toFixed(0)}%</span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {Math.round(row.avgRowsRead).toLocaleString()}
          </span>
        );
      },
      type: "right",
    },
    {
      name: "Avg Query Length",
      accessorKey: "avgQueryLength",
      cell: (row: any) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && row.provider !== "human" && humanBaseline;

        if (showPercentage) {
          const percentage =
            (row.avgQueryLength / humanBaseline.avgQueryLength) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">{Math.round(row.avgQueryLength)}</span>
              <span className="text-sm text-[#C6C6C6]">{percentage.toFixed(0)}%</span>
            </div>
          );
        }
        return (
          <span className="font-mono">{Math.round(row.avgQueryLength)}</span>
        );
      },
      type: "right",
    },
    {
      name: "Efficiency Score",
      accessorKey: "efficiencyScore",
      cell: (row: any) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && row.provider !== "human" && humanBaseline;

        return (
          <div className="flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                row.efficiencyScore < 1000
                  ? "bg-green-500"
                  : row.efficiencyScore < 5000
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            />
            <div className="space-x-2">
            <span className="font-mono">{row.efficiencyScore.toFixed(2)}</span>
              {showPercentage && (
                <span className="text-sm text-[#C6C6C6]">
                  {((row.efficiencyScore / humanBaseline.efficiencyScore) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        );
      },
      type: "right",
    },
    {
      name: "Total Queries",
      accessorKey: "totalQueries",
      cell: (row: any) => <span className="font-mono">{row.totalQueries}</span>,
      type: "right",
    },
  ];

  return (
    <div className="min-h-screen p-8 font-sans">
      <h1 className="text-3xl mb-8">
        AI SQL Generation Benchmark Results
      </h1>

      <div className="mb-4 flex items-center">
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showRelative}
            onChange={(e) => setShowRelative(e.target.checked)}
            className="form-checkbox "
          />
          <span className="ml-2 text-sm text-[#F4F4F4]">
            Show metrics relative to human baseline
          </span>
        </label>
      </div>

      <div className="overflow-x-auto shadow-lg rounded-lg">
        <Table columns={columns} data={[...humanMetrics, ...modelMetrics]} />
      </div>

      <div className="mt-8 text-sm bg-[#353535] p-4">
        <h2 className="text-sm mb-2 text-[#C6C6C6]">Metrics Explanation</h2>

        <ul className="space-y-2 text-[#C6C6C6]">
          <li>
            <span className="text-[#F4F4F4]">Success Rate:</span> Percentage of queries that executed
            successfully
          </li>
          <li>
            <span className="text-[#F4F4F4]">First Attempt Rate:</span> Percentage of queries that
            succeeded on the first try
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Execution:</span> Average time taken to execute the
            query in milliseconds
          </li>
          <li>
            <span className="text-[#F4F4F4]">LLM Gen Time:</span> Average time for the LLM to generate
            the SQL query in seconds
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Attempts:</span> Average number of attempts needed per
            query
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Rows Read:</span> Average number of rows read per
            query (lower is better)
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Query Length:</span> Average length of generated SQL
            queries in characters
          </li>
          <li>
            <span className="text-[#F4F4F4]">Efficiency Score:</span> Custom metric combining execution
            time, data read, and success rate (lower is better)
          </li>
        </ul>
      </div>
    </div>
  );
}
