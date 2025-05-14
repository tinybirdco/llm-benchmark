import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";

type ColumnDefinition<T> = {
  name: string;
  accessorKey: string;
  cell: (row: T) => React.ReactNode;
  type?: "left" | "right";
  sortable?: boolean;
  description?: string;
  className?: string;
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc" | null;
};

export const Table = <T extends Record<string, any>>({
  columns,
  data,
  defaultSort,
}: {
  columns: ColumnDefinition<T>[];
  data: T[];
  defaultSort?: SortConfig;
}) => {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(
    defaultSort || null
  );

  const handleSort = (column: ColumnDefinition<T>) => {
    if (!column.sortable) return;

    setSortConfig((currentSort) => {
      if (!currentSort || currentSort.key !== column.accessorKey) {
        return { key: column.accessorKey, direction: "asc" };
      }

      if (currentSort.direction === "asc") {
        return { key: column.accessorKey, direction: "desc" };
      }

      if (currentSort.direction === "desc") {
        return null;
      }

      return currentSort;
    });
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const getSortIcon = (column: ColumnDefinition<T>) => {
    if (!column.sortable) return null;
    if (!sortConfig || sortConfig.key !== column.accessorKey)
      return (
        <ArrowUp className="w-4 h-4 hover:opacity-100 hover:text-accent opacity-50 group-hover:text-white" />
      );
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-4 h-4 text-accent" />
    ) : (
      <ArrowDown className="w-4 h-4 text-accent" />
    );
  };

  return (
    <div className="w-full min-w-[1200px] bg-[#0A0A0A] overflow-auto table-auto">
      <div className="table-header-group">
        {columns.map((column) => (
          <div
            className={cn(
              "align-middle items-center text-sm table-cell text-nowrap whitespace-nowrap group",
              column.sortable ? "cursor-pointer hover:bg-[#353535]" : "",
              column.type === "right" ? "text-right" : "text-left",
              column.accessorKey === "rank" ? "w-[60px]" : "",
              column.accessorKey === "provider" ? "w-[120px]" : "",
              column.accessorKey === "model" ? "w-[300px]" : "",
              column.accessorKey === "efficiencyScore" ? "w-[120px]" : "",
              column.accessorKey === "successRate" ? "w-[150px]" : "",
              column.accessorKey === "firstAttemptRate" ? "w-[150px]" : "",
              column.accessorKey === "avgTotalDuration" ? "w-[150px]" : "",
              column.accessorKey === "avgAttempts" ? "w-[120px]" : "",
              column.accessorKey === "avgExecutionTime" ? "w-[150px]" : "",
              column.accessorKey === "avgRowsRead" ? "w-[150px]" : "",
              column.accessorKey === "avgBytesRead" ? "w-[150px]" : ""
            )}
            key={column.name}
          >
            <TooltipProvider key={column.name}>
              <Tooltip>
                <TooltipTrigger
                  disabled={!column.description}
                  className="!outline-none"
                >
                  <div
                    onClick={() => handleSort(column)}
                    className={cn(
                      "p-2.5 lg:p-4 align-middle text-sm text-nowrap whitespace-nowrap group !outline-none",
                      column.type === "right" ? "text-right" : "text-left",
                      sortConfig?.key === column.accessorKey ? "font-bold" : "",
                      column.sortable ? "cursor-pointer" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          column.accessorKey === "rank"
                            ? "w-0 overflow-hidden lg:overflow-auto lg:w-auto group-hover:text-accent"
                            : "",
                          !!column.description
                            ? "decoration-dotted underline underline-offset-2 decoration-text/50"
                            : "",
                          "group-hover:text-accent"
                        )}
                      >
                        {column.name}
                      </span>
                      <div className="bg-transparent pl-2 -ml-1.5 -mr-0.5">
                        {getSortIcon(column)}
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {column.description}{" "}
                  <TooltipArrow className="fill-[#262626]" />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </div>
      <div className="table-row-group">
        {sortedData.map((row) => (
          <div
            key={crypto.randomUUID()}
            className={cn("table-row lg:hover:bg-[#353535]")}
          >
            {columns.map((column) => (
              <div
                key={column.name}
                className={cn(
                  "p-2.5 lg:p-4 align-middle table-cell text-sm text-nowrap whitespace-nowrap border-t border-t-background-secondary",
                  column.type === "right" ? "text-right" : "text-left pr-6",
                  column.className
                )}
              >
                {column.cell(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
