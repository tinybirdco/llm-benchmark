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

type ColumnDefinition = {
  name: string;
  accessorKey: string;
  cell: (row: unknown) => React.ReactNode;
  type?: "left" | "right";
  sortable?: boolean;
  description?: string;
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
  data: Record<string, unknown>[];
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
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

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
        <ChevronsUpDownIcon className="w-3 h-3 group-hover:opacity-50 opacity-0" />
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
              "align-start items-center text-sm table-cell text-nowrap whitespace-nowrap h-[52px] group",
              column.sortable ? "cursor-pointer hover:bg-[#353535]" : ""
            )}
            key={column.name}
          >
            <TooltipProvider key={column.name}>
              <Tooltip>
                <TooltipTrigger disabled={!column.description}>
                  <div
                    onClick={() => handleSort(column)}
                    className={cn(
                      "p-4 align-start text-sm text-nowrap whitespace-nowrap",
                      column.type === "right" ? "text-right" : "text-left",
                      sortConfig?.key === column.accessorKey ? "font-bold" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {column.name}
                      <HelpCircle className="w-3 h-3 group-hover:opacity-50 opacity-0" />
                      {getSortIcon(column)}
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
        {sortedData.map((row) => (
          <div
            key={crypto.randomUUID()}
            className="table-row hover:bg-[#353535]"
          >
            {columns.map((column) => (
              <div
                key={column.name}
                className={`p-4 align-start table-cell text-sm text-nowrap whitespace-nowrap ${
                  column.type === "right" ? "text-right" : "text-left pr-6"
                }`}
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
