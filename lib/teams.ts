import { lookupPlayer } from "@/lib/data/resolve-id";
import { fillStarters } from "@/lib/sim/engine";
import type { BuiltTeam, Player, Team } from "@/lib/types";

export function assembleTeam(team: Team, known: Player[] | Record<string, Player>): BuiltTeam {
  const players = team.playerIds
    .map((id) => lookupPlayer(known, id))
    .filter((player): player is Player => Boolean(player && player.league === team.league));
  const built: BuiltTeam = { ...team, players, starters: [] };
  built.starters = fillStarters(built);
  return built;
}
