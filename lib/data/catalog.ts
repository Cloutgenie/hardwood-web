import { getPlayer, playersForLeague } from "@/lib/data/store";
import { fillStarters } from "@/lib/sim/engine";
import type { BuiltTeam, League, Player, Team } from "@/lib/types";

export { getPlayer, playersForLeague } from "@/lib/data/store";

export const CATALOG: Record<League, Player[]> = new Proxy({} as Record<League, Player[]>, {
  get(_target, league: string) {
    if (league === "nba" || league === "college") return playersForLeague(league);
    return undefined;
  },
});

export function buildTeam(team: Team): BuiltTeam {
  const players = team.playerIds
    .map((id) => getPlayer(id))
    .filter((p): p is Player => Boolean(p && p.league === team.league));
  const built: BuiltTeam = { ...team, players, starters: [] };
  built.starters = fillStarters(built);
  return built;
}

export function assembleTeam(team: Team, known: Player[] = []): BuiltTeam {
  const players = team.playerIds
    .map((id) => known.find((player) => player.id === id) ?? getPlayer(id))
    .filter((p): p is Player => Boolean(p && p.league === team.league));
  const built: BuiltTeam = { ...team, players, starters: [] };
  built.starters = fillStarters(built);
  return built;
}
