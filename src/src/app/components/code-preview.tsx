export const CodePreview = ({
  sql,
  isExpanded,
  onExpandChange,
}: {
  sql: string;
  isExpanded: boolean;
  onExpandChange?: (expanded: boolean) => void;
}) => {
  const handleExpandToggle = (expanded: boolean) => {
    onExpandChange?.(expanded);
  };

  if (!sql) return null;

  return (
    <div>
      {!isExpanded ? (
        <div className="flex items-center gap-2">
          <code className="text-sm text-[#C6C6C6] truncate">{sql}</code>
          <button
            onClick={() => handleExpandToggle(true)}
            className="text-sm text-[#27F795] hover:text-[#1ac177] whitespace-nowrap flex items-center gap-1"
          >
            show code
            <span className="text-lg leading-none">+</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => handleExpandToggle(false)}
              className="text-sm text-[#C6C6C6] hover:text-[#F4F4F4] flex items-center gap-1"
            >
              Hide code
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
          <pre className="p-2 rounded overflow-x-auto text-sm">
            <code className="text-[#C6C6C6]">{sql}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
