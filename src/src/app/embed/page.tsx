import { fetchLeaderboardData } from "@/lib/fetch-benchmark-data";
import { EmbedClient } from "./embed-client";

export const revalidate = 300;

export default async function EmbedPage() {
  const { modelMetrics, humanMetrics } = await fetchLeaderboardData();
  return (
    <EmbedClient modelMetrics={modelMetrics} humanMetrics={humanMetrics} />
  );
}
