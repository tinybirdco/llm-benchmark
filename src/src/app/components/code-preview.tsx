import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import { ModelMetrics } from "@/lib/eval";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightIcon, PlusIcon } from "lucide-react";

type PreviewMetric = ModelMetrics & {
  sql?: string;
  question?: string;
  sqlError?: string;
};

export function PreviewModal({ metric }: { metric: PreviewMetric }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const classNames =
    "text-sm text-accent hover:underline hover:underline-offset-2 inline-flex items-center gap-x-1 cursor-pointer";

  return (
    <>
      <div className="flex gap-x-4 items-center">
        {metric.sql && (
          <button className={classNames} onClick={() => setIsOpen(true)}>
            show result <PlusIcon className="w-3 h-3" />
          </button>
        )}

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
          <DialogClose className="absolute top-4 right-4" />
          <DialogTitle className="mt-3">{metric.model}</DialogTitle>
          <DialogDescription>
            {metric.question ?? metric.name}
          </DialogDescription>

          <h3 className="text-lg font-medium mt-4">Generated SQL</h3>
          <pre className="bg-background-secondary p-4 text-sm w-full overflow-x-auto">
            {metric.sql || "No SQL generated"}
          </pre>

          {metric.sqlError && (
            <>
              <h3 className="text-lg font-medium mt-4">Error</h3>
              <pre className={cn("p-4 text-sm w-full overflow-x-auto bg-[#FF0000]/40 text-white")}>
                {metric.sqlError}
              </pre>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
