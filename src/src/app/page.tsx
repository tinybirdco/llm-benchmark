"use client";

import { useState } from "react";

import { Header } from "./components/nav";
import { BenchmarkTable } from "./components/benchmark-table";
import { useBenchmarkData } from "@/lib/use-benchmark-data";

export default function Home() {
  const { modelMetrics } = useBenchmarkData();
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
