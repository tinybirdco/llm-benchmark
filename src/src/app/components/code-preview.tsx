import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import { ModelMetrics } from "@/lib/eval";
import { useSingleResult } from "@/lib/use-single-result";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightIcon, PlusIcon } from "lucide-react";

export function PreviewModal({ metric }: { metric: ModelMetrics }) {
  const [isOpen, setIsOpen] = useState(false);
  const result = useSingleResult(metric.model, metric.name);

  const router = useRouter();
  const pathname = usePathname();

  const classNames =
    "text-sm text-accent hover:underline hover:underline-offset-2 inline-flex items-center gap-x-1 cursor-pointer";

  return (
    <>
      <div className="flex gap-x-4 items-center">
        <button className={classNames} onClick={() => setIsOpen(true)}>
          show result <PlusIcon className="w-3 h-3" />
        </button>

        {pathname.includes("models") ? (
          <button
            className={classNames}
            onClick={() =>
              router.push(`/questions/${encodeURIComponent(metric.name)}`)
            }
          >
            compare models <ArrowRightIcon className="w-3 h-3" />
          </button>
        ) : (
          <button
            className={classNames}
            onClick={() =>
              router.push(`/models/${encodeURIComponent(metric.model)}`)
            }
          >
            all questions <ArrowRightIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="font-sans max-h-[80vh] w-full max-w-[800px] overflow-y-auto">
          <DialogClose className="absolute top-4 right-4 bg-" />
          <DialogTitle className="mt-3">{metric.model}</DialogTitle>
          <DialogDescription>
            {Array.isArray(result?.attempts) &&
            result.attempts[0]?.question?.question
              ? result.attempts[0].question.question
              : result?.question && "question" in result.question
              ? (result.question as any).question
              : result?.question?.content ?? ""}
          </DialogDescription>

          <h3 className="text-lg font-medium mt-4">Generated SQL</h3>
          {result && (
            <pre className="bg-background-secondary p-4 text-sm w-full overflow-x-auto">
              {result.sql}
            </pre>
          )}

          <h3 className="text-lg font-medium mt-4">Results</h3>
          {result?.sqlResult && (
            <div className={cn("p-2 text-sm w-full overflow-x-auto", result.sqlResult?.error ? "bg-[#FF0000]/40 text-white" : "bg-background-secondary")}>
              <GenericTable
                data={result.sqlResult.data}
                meta={result.sqlResult.meta}
                error={result.sqlResult.error}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

type ColumnMeta = {
  name: string;
  type: string;
};

export default function GenericTable({
  data,
  meta,
  error,
}: {
  data: Record<string, unknown>[];
  meta?: ColumnMeta[];
  error?: string;
}) {
  if (!data || !meta)
    return (
      <div className="space-y-4 overflow-x-auto">
        {error && (
          <pre className="p-4 text-white text-sm w-full overflow-x-auto">
            {error}
          </pre>
        )}
      </div>
    );

  return (
    <table className="border-collapse !text-sm font-mono">
      <thead>
        <tr>
          {meta.map((col) => (
            <th key={col.name} className={cn("px-2 py-1.5 text-left")}>
              {col.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {meta.map((col) => (
              <td key={col.name} className={cn("px-2 py-1.5 text-left")}>
                {String(row[col.name] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
