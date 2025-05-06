import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import { ModelMetric } from "../questions/[pipename]/page";
import { useSingleResult } from "@/lib/use-single-result";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightIcon, PlusIcon, ZoomInIcon } from "lucide-react";

export function PreviewModal({ metric }: { metric: ModelMetric }) {
  const [isOpen, setIsOpen] = useState(false);
  const result = useSingleResult(metric.model, metric.name);

  const router = useRouter();
  const pathname = usePathname();

  const classNames = "text-sm text-[#c6c6c6] hover:text-[#27F795] inline-flex items-center gap-x-1";

  return (
    <>
      <div className="flex gap-x-4 items-center">
        <button
          className={classNames}
          onClick={() => setIsOpen(true)}
        >
          <PlusIcon className="w-3 h-3" /> show result 
        </button>

        {pathname.includes("models") ? (
          <button
            className={classNames}
            onClick={() => router.push(`/questions/${encodeURIComponent(metric.name)}`)}
          >
            compare models <ArrowRightIcon className="w-3 h-3" />
          </button>
        ) : (
          <button
            className={classNames}
            onClick={() => router.push(`/models/${encodeURIComponent(metric.model)}`)}
          >
            all questions <ArrowRightIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="font-sans max-h-[80vh] w-full max-w-[800px] overflow-y-auto">
          <DialogClose />
          <DialogTitle className="text-lg font-medium font-mono">
            {metric.model}
          </DialogTitle>
          <DialogDescription>
            "{metric.attempts?.[0]?.question?.question || JSON.stringify(result?.question?.content ?? "")}"
          </DialogDescription>

          <h3 className="text-lg font-medium mt-4">Generated SQL</h3>
          {result && (
            <pre className="bg-[#353535] p-4 text-sm w-full overflow-x-auto">
              {result.sql}
            </pre>
          )}

          <h3 className="text-lg font-medium mt-4">Results</h3>
          {result && (
            <GenericTable
              data={result.sqlResult.data}
              meta={result.sqlResult.meta}
              error={result.sqlResult.error}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function GenericTable({
  data,
  meta,
  error,
}: {
  data: Record<string, unknown>[];
  meta: Record<string, unknown>[];
  error?: string;
}) {
  if (!data || !meta)
    return (
      <div className="space-y-4 overflow-x-auto">
        <p className="text-sm">No valid query generated, or query failed.</p>

        {error && (
          <pre className="p-4 bg-[#f00]/10 text-[#f00] text-sm w-full overflow-x-auto">
            {error}
          </pre>
        )}
      </div>
    );

  return (
    <table className="border-collapse !text-sm font-mono">
      <thead>
        <tr>
          {meta.map((col, idx) => (
            <th key={col.name} className={cn("px-2 py-1.5 text-left")}>
              {col.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {meta.map((col, idx) => (
              <td key={col.name} className={cn("px-2 py-1.5 text-left")}>
                {row[col.name]?.toLocaleString?.() ?? row[col.name]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
