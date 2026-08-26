import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { filterPlayers } from "@/lib/data/search";
import { hydratePlayer } from "@/lib/ratings";
import type { League, Player, PlayerSource, Position } from "@/lib/types";

type Cache = {
  players: Record<League, Player[]>;
  byId: Map<string, Player>;
};

let cache: Cache | null = null;

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), "data", name), "utf8")) as T;
}

function loadCache(): Cache {
  if (cache) return cache;
  const aliases = loadJson<Record<string, string>>("aliases.json");
  const nba = (loadJson<PlayerSource[]>("nba.json")).map(hydratePlayer);
  const college = (loadJson<PlayerSource[]>("college.json")).map(hydratePlayer);
  nba.sort((a, b) => b.ratings.overall - a.ratings.overall || a.name.localeCompare(b.name));
  college.sort((a, b) => b.ratings.overall - a.ratings.overall || a.name.localeCompare(b.name));
  const byId = new Map<string, Player>();
  for (const player of [...nba, ...college]) {
    byId.set(player.id, player);
  }
  for (const [alias, id] of Object.entries(aliases)) {
    const player = byId.get(id);
    if (player) byId.set(alias, player);
  }
  cache = { players: { nba, college }, byId };
  return cache;
}

export function getPlayer(id: string): Player | undefined {
  return loadCache().byId.get(id);
}

export function playersForLeague(league: League): Player[] {
  return loadCache().players[league];
}

export function catalogCounts(): Record<League, number> {
  const { players } = loadCache();
  return { nba: players.nba.length, college: players.college.length };
}

export function searchPlayers(options: {
  league: League;
  query?: string;
  pos?: Position | "ALL";
  ids?: string[];
  limit?: number;
}): { total: number; players: Player[] } {
  const { league, query = "", pos = "ALL", ids, limit = 80 } = options;
  if (ids?.length) {
    const players = ids.map(getPlayer).filter((p): p is Player => Boolean(p && p.league === league));
    return { total: players.length, players };
  }
  const pool = playersForLeague(league).filter((player) => {
    if (pos !== "ALL" && !player.positions.includes(pos)) return false;
    return true;
  });
  return filterPlayers(pool, query, limit);
}
