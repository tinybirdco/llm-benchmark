"use client";

import { BenchmarkTable } from "../components/benchmark-table";

export default function EmbedPage() {
  return (
    <div className="w-full h-full bg-[#0A0A0A] font-sans relative">
      <div className="absolute top-2 left-2 z-10">
        <a 
          href="https://tinybird.co" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center justify-start gap-2 whitespace-nowrap text-sm font-normal bg-[#27F795] text-[#0a0a0a] shadow hover:bg-[#267A52] hover:text-white transition-colors px-4 py-2 cursor-pointer hover:cursor-pointer"
        >
          Powered by tinybird.co
        </a>
      </div>
      <div className="pt-12">
        <BenchmarkTable />
      </div>
    </div>
  );
}
