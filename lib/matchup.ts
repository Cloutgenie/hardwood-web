import type { GameResult, League, Team } from "@/lib/types";

const KEY = "hardwood-game";

export function emptyTeam(league: League, side: "home" | "away"): Team {
  return {
    name: side === "home" ? "Home" : "Away",
    abbr: side === "home" ? "HOM" : "AWY",
    league,
    playerIds: [],
  };
}

export function saveGame(result: GameResult) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    throw new Error("Could not keep this game in the tab. Tip off again.");
  }
}

export function loadGame(): GameResult | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameResult;
  } catch {
    return null;
  }
}

export function subscribeGame(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function readGameRaw(): string | null {
  return sessionStorage.getItem(KEY);
}
