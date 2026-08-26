import { BuilderClient } from "@/components/builder-client";
import type { League } from "@/lib/types";

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ league?: string }>;
}) {
  const params = await searchParams;
  const league: League = params.league === "college" ? "college" : "nba";
  return <BuilderClient league={league} />;
}
