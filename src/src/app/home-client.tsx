"use client";

import { useState } from "react";
import { Header } from "./components/nav";
import { BenchmarkTable } from "./components/benchmark-table";
import { ModelMetrics } from "@/lib/eval";

export function HomeClient({
  modelMetrics,
  humanMetrics,
}: {
  modelMetrics: ModelMetrics[];
  humanMetrics: ModelMetrics[];
}) {
  const [showRelative, setShowRelative] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  return (
    <div className="min-h-screen py-8 px-4 lg:px-8 font-sans">
      <Header
        data={modelMetrics}
        selectedModels={selectedModels}
        selectedProviders={selectedProviders}
        onModelChange={setSelectedModels}
        onProviderChange={setSelectedProviders}
        showRelative={showRelative}
        onShowRelativeChange={setShowRelative}
      />

      <BenchmarkTable
        modelMetrics={modelMetrics}
        humanMetrics={humanMetrics}
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
