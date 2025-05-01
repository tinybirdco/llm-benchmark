type ColumnDefinition = {
  name: string;
  accessorKey: string;
  cell: (row: unknown) => React.ReactNode;
  type?: "left" | "right";
};

export const Table = ({
  columns,
  data,
  expandedRows,
}: {
  columns: ColumnDefinition[];
  data: any[];
  expandedRows?: string[];
}) => {
  return (
    <div className="w-full bg-[#0A0A0A] overflow-auto table-auto">
      <div className="table-header-group">
        {columns.map((column) => (
          <div
            key={column.name}
            className={`p-4 align-start text-sm table-cell text-nowrap whitespace-nowrap ${
              column.type === "right" ? "text-right" : "text-left"
            }`}
          >
            {column.name}
          </div>
        ))}
      </div>
      <div className="table-row-group">
        {data.map((row) => {
          const isExpanded = expandedRows?.includes(row.key);

          return (
            <div
              key={crypto.randomUUID()}
              className={`table-row hover:bg-[#353535] ${
                isExpanded ? "bg-[#353535]" : ""
              }`}
            >
              {columns.map((column, idx) => (
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
          );
        })}
      </div>
    </div>
  );
};
