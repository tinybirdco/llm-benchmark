"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import humanResults from "../../benchmark/results-human.json";

import { Header } from "./components/nav";
import { ProgressBar } from "./components/progress";
import { Table } from "./components/table";
import { calculateModelMetrics, calculateRanks } from "@/lib/eval";
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

    return calculateRanks(Object.values(modelGroups).map((group) =>
      calculateModelMetrics(group)
    ));
  }, []);

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

    return calculateRanks(Object.values(modelGroups).map((group) =>
      calculateModelMetrics(group)
    ));
  }, []);

  const columns = [
    {
      name: "Rank",
      accessorKey: "rank",
      sortable: true,
      cell: (row: unknown) => row.provider === "human" ? "--" :  (
        <span className="font-mono">#{(row as any).rank}</span>
      ),
      type: "right",
    },
    {
      name: "Provider",
      accessorKey: "provider",
      sortable: true,
      cell: (row: unknown) => (row as any).provider,
    },
    {
      name: "Model",
      accessorKey: "model",
      sortable: true,
      cell: (row: unknown) =>
        (row as any).provider === "human" ? (
          (row as any).model
        ) : (
          <ModelCell model={(row as any).model} sql={(row as any).sql || ""} />
        ),
    },
    {
      name: "Success Rate",
      accessorKey: "successRate",
      sortable: true,
      cell: (row: unknown) => {
        if ((row as any).provider === "human") {
          return "--";
        }
        return (
          <div className="flex items-center">
            <ProgressBar progress={(row as any).successRate} />
            <span className="font-mono">
              {(row as any).successRate.toFixed(1)}
            </span>
          </div>
        );
      },
    },
    {
      name: "First Attempt Rate",
      accessorKey: "firstAttemptRate",
      sortable: true,
      cell: (row: unknown) => {
        if ((row as any).provider === "human") {
          return "--";
        }
        return (
          <div className="flex items-center">
            <ProgressBar progress={(row as any).firstAttemptRate} />
            <span className="font-mono">
              {(row as any).firstAttemptRate.toFixed(1)}%
            </span>
          </div>
        );
      },
    },
    {
      name: "Avg Execution (ms)",
      accessorKey: "avgExecutionTime",
      sortable: true,
      cell: (row: unknown) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && (row as any).provider !== "human" && humanBaseline;
        if (showPercentage) {
          const percentage =
            (((row as any).avgExecutionTime * 1000) /
              (humanBaseline.avgExecutionTime * 1000)) *
            100;
          return (
            <div className="space-x-2">
              <span className="font-mono">
                {((row as any).avgExecutionTime * 1000).toFixed(2)}
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {((row as any).avgExecutionTime * 1000).toFixed(2)}
          </span>
        );
      },
      type: "right",
    },
    {
      name: "LLM Gen Time (s)",
      accessorKey: "avgTotalDuration",
      sortable: true,
      cell: (row: unknown) =>
        (row as any).provider === "human" ? (
          "--"
        ) : (
          <span className="font-mono">
            {(row as any).avgTotalDuration.toFixed(3)}
          </span>
        ),
      type: "right",
    },
    {
      name: "Avg Attempts",
      accessorKey: "avgAttempts",
      sortable: true,
      cell: (row: unknown) => {
        if ((row as any).provider === "human") {
          return "--";
        }
        return (
          <span className="font-mono">
            {(row as any).avgAttempts.toFixed(2)}
          </span>
        );
      },
      type: "right",
    },
    {
      name: "Avg Rows Read",
      accessorKey: "avgRowsRead",
      sortable: true,
      cell: (row: unknown) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && (row as any).provider !== "human" && humanBaseline;

        if (showPercentage) {
          const percentage =
            ((row as any).avgRowsRead / humanBaseline.avgRowsRead) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">
                {Math.round((row as any).avgRowsRead).toLocaleString()}
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {Math.round((row as any).avgRowsRead).toLocaleString()}
          </span>
        );
      },
      type: "right",
    },
    {
      name: "Avg Data Read",
      accessorKey: "avgBytesRead",
      sortable: true,
      cell: (row: unknown) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && (row as any).provider !== "human" && humanBaseline;

        if (showPercentage) {
          const percentage =
            ((row as any).avgBytesRead / humanBaseline.avgBytesRead) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">
                {((row as any).avgBytesRead / (1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {((row as any).avgBytesRead / (1024 * 1024)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB
          </span>
        );
      },
      type: "right",
    },
    {
      name: "Avg Query Length",
      accessorKey: "avgQueryLength",
      sortable: true,
      cell: (row: unknown) => {
        const humanBaseline = humanMetrics.find((h) => h.provider === "human");
        const showPercentage =
          showRelative && (row as any).provider !== "human" && humanBaseline;

        if (showPercentage) {
          const percentage =
            ((row as any).avgQueryLength / humanBaseline.avgQueryLength) * 100;
          return (
            <div className="space-x-2">
              <span className="font-mono">
                {Math.round((row as any).avgQueryLength)}
              </span>
              <span className="text-sm text-[#C6C6C6]">
                {percentage.toFixed(0)}%
              </span>
            </div>
          );
        }
        return (
          <span className="font-mono">
            {(row as any).avgQueryLength.toFixed(0)}
          </span>
        );
      },
      type: "right",
    },
    {
      name: "Overall Score",
      accessorKey: "efficiencyScore",
      sortable: true,
      cell: (row: unknown) => {
        if ((row as any).provider === "human") {
          return "--";
        }
        return (
          <div className="inline-flex items-center">
            <div
              className={`w-2 h-2 rounded-full mr-2 ${
                (row as any).efficiencyScore < 1000
                  ? "bg-[#27F795]"
                  : (row as any).efficiencyScore < 5000
                  ? "bg-[#F7D727]"
                  : "bg-[#F72727]"
              }`}
            />
            <span className="font-mono">
              {(row as any).efficiencyScore.toFixed(2)}
            </span>
          </div>
        );
      },
      type: "right",
    },
    {
      name: "Total Queries",
      accessorKey: "totalQueries",
      sortable: true,
      cell: (row: unknown) => (
        <span className="font-mono">{(row as any).totalQueries}</span>
      ),
      type: "right",
    },
  ];

  return (
    <div className="min-h-screen p-8 font-sans">
      <Header />

      <div className="mb-4 flex items-center">
        <label className="inline-flex items-center cursor-pointer">
          <span className="custom-checkbox">
            <input
              type="checkbox"
              checked={showRelative}
              onChange={(e) => setShowRelative(e.target.checked)}
              // Add disabled or error props as needed
            />
            <span className="custom-checkbox-box">
              <svg className="checkmark" viewBox="0 0 16 16" fill="none" width="16" height="16">
                <path d="M4 8.5L7 11.5L12 5.5" stroke="#222" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </span>
          <span className="ml-2 text-sm text-[#F4F4F4]">
            Show metrics relative to human baseline
          </span>
        </label>
      </div>

      <div className="overflow-x-auto">
        <Table
          columns={columns}
          data={[...humanMetrics, ...modelMetrics]}
          defaultSort={{ key: "rank", direction: "asc" }}
        />
      </div>

      <div className="mt-8 text-sm bg-[#353535] p-4">
        <h2 className="text-sm mb-2 text-[#C6C6C6]">Metrics Explanation</h2>

        <ul className="space-y-2 text-[#C6C6C6]">
          <li>
            <span className="text-[#F4F4F4]">Success Rate:</span> Percentage of
            queries that executed successfully
          </li>
          <li>
            <span className="text-[#F4F4F4]">First Attempt Rate:</span>{" "}
            Percentage of queries that succeeded on the first try
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Execution:</span> Average time
            taken to execute the query in milliseconds
          </li>
          <li>
            <span className="text-[#F4F4F4]">LLM Gen Time:</span> Average time
            for the LLM to generate the SQL query in seconds
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Attempts:</span> Average number
            of attempts needed per query
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Rows Read:</span> Average
            number of rows read per query (lower is better)
          </li>
          <li>
            <span className="text-[#F4F4F4]">Avg Query Length:</span> Average
            length of generated SQL queries in characters
          </li>
          <li>
            <span className="text-[#F4F4F4]">Efficiency Score:</span> Custom
            metric combining execution time, data read, and success rate (lower
            is better)
          </li>
        </ul>
      </div>
    </div>
  );
}
