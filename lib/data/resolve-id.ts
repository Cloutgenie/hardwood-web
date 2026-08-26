import aliases from "@/data/aliases.json";
import type { Player } from "@/lib/types";

const ALIAS_TO_ID = aliases as Record<string, string>;

export function resolvePlayerId(id: string): string {
  return ALIAS_TO_ID[id] ?? id;
}

export function indexPlayers(known: Player[] | Record<string, Player>): Record<string, Player> {
  const record: Record<string, Player> = {};
  const entries = Array.isArray(known) ? known.map((player) => [player.id, player] as const) : Object.entries(known);
  for (const [key, player] of entries) {
    if (!player) continue;
    record[key] = player;
    record[player.id] = player;
    record[resolvePlayerId(key)] = player;
    record[resolvePlayerId(player.id)] = player;
  }
  return record;
}

export function lookupPlayer(known: Player[] | Record<string, Player>, id: string): Player | undefined {
  const record = indexPlayers(known);
  return record[id] ?? record[resolvePlayerId(id)];
}
