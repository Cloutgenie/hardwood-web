import type { CareerStats, League, PlayerSource, Position, Ratings } from "@/lib/types";

export function card(
  id: string,
  name: string,
  league: League,
  years: string,
  positions: Position[],
  heightIn: number,
  weightLb: number,
  stats: CareerStats,
  extra?: {
    school?: string;
    nbaTeams?: string;
    boosts?: Partial<Ratings>;
    note?: string;
  },
): PlayerSource {
  return {
    id,
    name,
    league,
    years,
    heightIn,
    weightLb,
    positions,
    stats,
    school: extra?.school,
    nbaTeams: extra?.nbaTeams,
    boosts: extra?.boosts,
    note: extra?.note,
  };
}

export function line(
  games: number,
  mpg: number,
  ppg: number,
  rpg: number,
  apg: number,
  spg: number,
  bpg: number,
  topg: number,
  fgPct: number,
  fg3Pct: number | null,
  ftPct: number,
  fg3Rate: number,
  ftaRate: number,
): CareerStats {
  return { games, mpg, ppg, rpg, apg, spg, bpg, topg, fgPct, fg3Pct, ftPct, fg3Rate, ftaRate };
}
