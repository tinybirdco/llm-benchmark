import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";
import { TooltipArrow } from "@radix-ui/react-tooltip";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

// Sortable column header component
const SortableColumnHeader = <T extends Record<string, any>>({
  column,
  sortConfig,
  onSort,
  columnWidth,
  onResize,
}: {
  column: ColumnDefinition<T>;
  sortConfig: SortConfig | null;
  onSort: (column: ColumnDefinition<T>) => void;
  columnWidth?: number;
  onResize?: (columnKey: string, width: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.accessorKey });

  const [isResizing, setIsResizing] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [startWidth, setStartWidth] = React.useState(0);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: columnWidth ? `${columnWidth}px` : undefined,
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(columnWidth || 150);
  };

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!isResizing || !onResize) return;
    
    const newWidth = Math.max(50, startWidth + (e.clientX - startX));
    onResize(column.accessorKey, newWidth);
  }, [isResizing, startX, startWidth, column.accessorKey, onResize]);

  const handleMouseUp = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

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
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "align-middle items-center text-sm table-cell text-nowrap whitespace-nowrap group relative",
        column.sortable ? "cursor-pointer hover:bg-[#353535]" : "",
        column.type === "right" ? "text-right" : "text-left",
        isDragging ? "opacity-50" : ""
      )}
    >
      <TooltipProvider key={column.accessorKey}>
        <Tooltip>
          <TooltipTrigger
            disabled={!column.description}
            className="!outline-none"
          >
            <div
              onClick={() => onSort(column)}
              className={cn(
                "p-2.5 lg:p-4 align-middle text-sm text-nowrap whitespace-nowrap group !outline-none",
                // String columns (rank, provider, model) should be left-aligned
                (column.accessorKey === "rank" || column.accessorKey === "provider" || column.accessorKey === "model") 
                  ? "text-left" 
                  : column.type === "right" ? "text-right" : "text-left",
                sortConfig?.key === column.accessorKey ? "font-bold" : "",
                column.sortable ? "cursor-pointer" : ""
              )}
            >
              <div className="flex items-center gap-2">
                <div 
                  {...attributes}
                  {...listeners}
                  className="flex-1 cursor-grab active:cursor-grabbing"
                >
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
                </div>
                <div 
                  className="bg-transparent pl-2 -ml-1.5 -mr-0.5 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSort(column);
                  }}
                >
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
      
      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/50 transition-colors",
          isResizing ? "bg-accent" : "bg-transparent"
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
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
  const [orderedColumns, setOrderedColumns] = React.useState<ColumnDefinition<T>[]>(columns);
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    setOrderedColumns(columns);
  }, [columns]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedColumns((items) => {
        const oldIndex = items.findIndex((item) => item.accessorKey === active.id);
        const newIndex = items.findIndex((item) => item.accessorKey === over.id);

        // Only proceed if both indices are valid
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        
        return items; // Return unchanged if indices are invalid
      });
    }
  };

  const handleColumnResize = (columnKey: string, width: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [columnKey]: width
    }));
  };

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
      const aHuman = a["provider"] === "human";
      const bHuman = b["provider"] === "human";
      if (aHuman && !bHuman) return -1;
      if (!aHuman && bHuman) return 1;

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full min-w-[1200px] bg-[#0A0A0A] overflow-auto table-auto">
        <div className="table-header-group">
          <SortableContext
            items={orderedColumns.map((col) => col.accessorKey)}
            strategy={horizontalListSortingStrategy}
          >
            {orderedColumns.map((column) => (
              <SortableColumnHeader
                key={column.accessorKey}
                column={column}
                sortConfig={sortConfig}
                onSort={handleSort}
                columnWidth={columnWidths[column.accessorKey]}
                onResize={handleColumnResize}
              />
            ))}
          </SortableContext>
        </div>
        <div className="table-row-group">
          {sortedData.map((row) => (
            <div
              key={crypto.randomUUID()}
              className={cn("table-row lg:hover:bg-[#353535]")}
            >
              {orderedColumns.map((column) => (
                <div
                  key={column.accessorKey}
                  style={{
                    width: columnWidths[column.accessorKey] ? `${columnWidths[column.accessorKey]}px` : undefined
                  }}
                  className={cn(
                    "p-2.5 lg:p-4 align-middle table-cell text-sm text-nowrap whitespace-nowrap border-t border-t-background-secondary",
                    // String columns (rank, provider, model) should be left-aligned
                    (column.accessorKey === "rank" || column.accessorKey === "provider" || column.accessorKey === "model")
                      ? "text-left"
                      : column.type === "right" ? "text-right" : "text-left pr-6",
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
    </DndContext>
  );
};
