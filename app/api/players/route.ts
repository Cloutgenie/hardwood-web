import { catalogCounts, searchPlayers } from "@/lib/data/store";
import type { League, Position } from "@/lib/types";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league: League = url.searchParams.get("league") === "college" ? "college" : "nba";
  const query = url.searchParams.get("q") ?? "";
  const pos = (url.searchParams.get("pos") as Position | "ALL" | null) ?? "ALL";
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 80)));
  const result = searchPlayers({ league, query, pos, ids, limit });
  const counts = catalogCounts();
  return NextResponse.json({
    league,
    poolSize: counts[league],
    matched: result.total,
    players: result.players,
  });
}
