import { fetchLeaderboardData } from "@/lib/fetch-benchmark-data";
import { HomeClient } from "./home-client";

export const revalidate = 300;

export default async function Home() {
  const { modelMetrics, questions } = await fetchLeaderboardData();

  return <HomeClient modelMetrics={modelMetrics} questions={questions} />;
}
