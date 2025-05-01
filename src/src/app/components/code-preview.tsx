import { useState } from 'react';

export const CodePreview = ({ sql }: { sql: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sql) return null;

  return (
    <div>
      {!isExpanded ? (
        <div className="flex items-center gap-2">
          <code className="text-xs text-[#27F795] truncate">
            {sql}
          </code>
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-[#27F795] hover:text-[#1ac177] whitespace-nowrap flex items-center gap-1"
          >
            show code
            <span className="text-lg leading-none">+</span>
          </button>
        </div>
      ) : (
        <div className="relative">
          <pre className="p-4 bg-[#353535] rounded overflow-x-auto text-sm">
            <code className="text-[#C6C6C6]">{sql}</code>
          </pre>
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-2 right-2 text-xs text-[#27F795] hover:text-[#1ac177] flex items-center gap-1"
          >
            Hide code
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
      )}
    </div>
  );
}; 