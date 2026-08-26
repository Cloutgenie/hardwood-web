import type { League, LeagueRules } from "@/lib/types";

export const LEAGUE_RULES: Record<League, LeagueRules> = {
  nba: {
    league: "nba",
    periods: 4,
    periodMinutes: 12,
    otMinutes: 5,
    shotClock: 24,
    bonusFouls: 5,
    dqFouls: 6,
    oneAndOne: false,
    targetPace: 100,
  },
  college: {
    league: "college",
    periods: 2,
    periodMinutes: 20,
    otMinutes: 5,
    shotClock: 30,
    bonusFouls: 7,
    doubleBonusFouls: 10,
    dqFouls: 5,
    oneAndOne: true,
    targetPace: 68,
  },
};

export function periodLabel(league: League, period: number): string {
  const rules = LEAGUE_RULES[league];
  if (period <= rules.periods) {
    return league === "nba" ? `Q${period}` : period === 1 ? "1H" : "2H";
  }
  const ot = period - rules.periods;
  return ot === 1 ? "OT" : `${ot}OT`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export function regulationSeconds(league: League): number {
  const rules = LEAGUE_RULES[league];
  return rules.periods * rules.periodMinutes * 60;
}
