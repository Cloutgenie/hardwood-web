import type { Player } from "@/lib/types";

export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  return fold(text).split(" ").filter(Boolean);
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > 1) return 2;
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[b.length] ?? 2;
}

export function tokenMatches(query: string, candidate: string): boolean {
  if (candidate === query) return true;
  if (query.length >= 2 && candidate.startsWith(query)) return true;
  if (query.length >= 3 && candidate.includes(query)) return true;
  if (query.length >= 4 && editDistance(query, candidate) <= 1) return true;
  return false;
}

function playerTokens(player: Player): string[] {
  return tokens([player.name, player.school ?? "", player.nbaTeams ?? ""].join(" "));
}

export function playerMatchesQuery(player: Player, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const hay = fold(`${player.name} ${player.school ?? ""} ${player.nbaTeams ?? ""}`);
  if (hay.includes(q)) return true;
  const qTokens = q.split(" ").filter(Boolean);
  const hayTokens = playerTokens(player);
  return qTokens.every((qt) => hayTokens.some((token) => tokenMatches(qt, token)));
}

export function scoreMatch(player: Player, query: string): number {
  const q = fold(query);
  const name = fold(player.name);
  const nameTokens = tokens(player.name);
  const qTokens = tokens(query);
  let score = player.ratings.overall + player.stats.ppg;
  if (!q) return score;
  if (name === q) score += 1000;
  if (name.startsWith(q)) score += 400;
  if (name.includes(q)) score += 200;
  const lastQuery = qTokens.at(-1);
  const lastName = nameTokens.at(-1);
  if (lastQuery && lastName && lastName === lastQuery) score += 160;
  if (qTokens[0] && nameTokens[0] && tokenMatches(qTokens[0], nameTokens[0])) score += 80;
  return score;
}

export function filterPlayers(players: Player[], query: string, limit: number): {
  total: number;
  players: Player[];
} {
  const q = fold(query);
  if (!q) return { total: players.length, players: players.slice(0, limit) };
  const matched = players.filter((player) => playerMatchesQuery(player, query));
  matched.sort((a, b) => scoreMatch(b, query) - scoreMatch(a, query) || a.name.localeCompare(b.name));
  return { total: matched.length, players: matched.slice(0, limit) };
}
