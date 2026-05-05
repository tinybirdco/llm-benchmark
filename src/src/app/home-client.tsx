"use client";

import { useState } from "react";
import { Header } from "./components/nav";
import { BenchmarkTable } from "./components/benchmark-table";
import { ModelMetrics } from "@/lib/eval";
import { QuestionInfo } from "@/lib/fetch-benchmark-data";

export function HomeClient({
  modelMetrics,
  questions,
}: {
  modelMetrics: ModelMetrics[];
  questions: QuestionInfo[];
}) {
  const [showRelative, setShowRelative] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  return (
    <div className="min-h-screen py-8 px-4 lg:px-8 font-sans">
      <Header
        data={modelMetrics}
        questions={questions}
        selectedModels={selectedModels}
        selectedProviders={selectedProviders}
        onModelChange={setSelectedModels}
        onProviderChange={setSelectedProviders}
        showRelative={showRelative}
        onShowRelativeChange={setShowRelative}
      />

      <BenchmarkTable
        modelMetrics={modelMetrics}
        showRelative={showRelative}
        selectedModels={selectedModels}
        selectedProviders={selectedProviders}
        onModelChange={setSelectedModels}
        onProviderChange={setSelectedProviders}
        onShowRelativeChange={setShowRelative}
      />
    </div>
  );
}
