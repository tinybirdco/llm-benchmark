"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BenchmarkTable } from "../components/benchmark-table";
import { ModelMetrics } from "@/lib/eval";

function EmbedContent({
  modelMetrics,
}: {
  modelMetrics: ModelMetrics[];
}) {
  const searchParams = useSearchParams();
  const hideBranding = searchParams.get("hide_branding") === "true";

  return (
    <div className="w-full h-full bg-[#0A0A0A] font-sans relative">
      {!hideBranding && (
        <div className="absolute top-2 left-2 z-10">
          <a
            href="https://tinybird.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-start gap-2 whitespace-nowrap text-sm font-normal bg-[#27F795] text-[#0a0a0a] shadow hover:bg-[#267A52] hover:text-white transition-colors px-4 py-2 cursor-pointer hover:cursor-pointer"
          >
            Built by tinybird.co
          </a>
        </div>
      )}
      <div className={hideBranding ? "" : "pt-12"}>
        <BenchmarkTable modelMetrics={modelMetrics} />
      </div>
    </div>
  );
}

export function EmbedClient({
  modelMetrics,
}: {
  modelMetrics: ModelMetrics[];
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-full bg-[#0A0A0A] font-sans relative">
          <div className="pt-12 text-center text-white">Loading...</div>
        </div>
      }
    >
      <EmbedContent modelMetrics={modelMetrics} />
    </Suspense>
  );
}
