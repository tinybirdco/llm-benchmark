import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  ChevronsUpDownIcon,
  ChevronUpIcon,
  HelpCircle,
} from "lucide-react";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { ModelMetrics } from "@/lib/eval";

type ColumnDefinition = {
  name: string;
  accessorKey: string;
  cell: (row: ModelMetrics) => React.ReactNode;
  type?: "left" | "right";
  sortable?: boolean;
  description?: string;
  className?: string;
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc" | null;
};

export const Table = ({
  columns,
  data,
  defaultSort,
}: {
  columns: ColumnDefinition[];
  data: ModelMetrics[];
  defaultSort?: SortConfig;
}) => {
  const [sortConfig, setSortConfig] = React.useState<SortConfig | null>(
    defaultSort || null
  );

  const handleSort = (column: ColumnDefinition) => {
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
      const aValue = a[sortConfig.key as keyof ModelMetrics];
      const bValue = b[sortConfig.key as keyof ModelMetrics];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  const getSortIcon = (column: ColumnDefinition) => {
    if (!column.sortable) return null;
    if (!sortConfig || sortConfig.key !== column.accessorKey)
      return (
        <ChevronsUpDownIcon className="w-3 h-3 group-hover:opacity-100 opacity-50" />
      );
    return sortConfig.direction === "asc" ? (
      <ChevronUpIcon className="w-3 h-3" />
    ) : (
      <ChevronDownIcon className="w-3 h-3" />
    );
  };

  return (
    <div className="w-full bg-[#0A0A0A] overflow-auto table-auto">
      <div className="table-header-group">
        {columns.map((column) => (
          <div
            className={cn(
              "align-middle items-center text-sm table-cell text-nowrap whitespace-nowrap group",
              column.sortable ? "cursor-pointer hover:bg-[#353535]" : "",
              column.type === "right" ? "text-right" : "text-left"
            )}
            key={column.name}
          >
            <TooltipProvider key={column.name}>
              <Tooltip>
                <TooltipTrigger disabled={!column.description}>
                  <div
                    onClick={() => handleSort(column)}
                    className={cn(
                      "p-2.5 lg:p-4 align-middle text-sm text-nowrap whitespace-nowrap",
                      column.type === "right" ? "text-right" : "text-left",
                      sortConfig?.key === column.accessorKey ? "font-bold" : "",
                      column.sortable ? "cursor-pointer" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          column.accessorKey === "rank" ? "w-0 overflow-hidden lg:overflow-auto lg:w-auto" : ""
                        )}
                      >
                        {column.name}
                      </span>
                      <div className="flex items-center gap-1.5 bg-transparent pl-2 group-hover:bg-background-secondary -ml-1.5">
                        <HelpCircle className="w-3 h-3 group-hover:opacity-100 opacity-50 hidden lg:block" />
                        {getSortIcon(column)}
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{column.description}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </div>
      <div className="table-row-group">
        {sortedData.map((row, idx) => (
          <div
            key={crypto.randomUUID()}
            className={cn("table-row lg:hover:bg-[#353535]", idx % 2 === 0 ? "bg-[#1A1A1A]" : "")}
          >
            {columns.map((column) => (
              <div
                key={column.name}
                className={cn(
                  "p-2.5 lg:p-4 align-middle table-cell text-sm text-nowrap whitespace-nowrap",
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
