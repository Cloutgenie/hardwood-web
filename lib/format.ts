import type { PlayerBox, TeamBox } from "@/lib/types";

export function fgLine(box: Pick<PlayerBox, "fgm" | "fga" | "fg3m" | "fg3a">): string {
  return `${box.fgm}-${box.fga} FG, ${box.fg3m}-${box.fg3a} 3P`;
}

export function ftLine(box: Pick<PlayerBox, "ftm" | "fta">): string {
  return `${box.ftm}-${box.fta} FT`;
}

export function pct(made: number, att: number): string {
  if (att === 0) return "—";
  return `${((made / att) * 100).toFixed(1)}%`;
}

export function minutesLabel(minutes: number): string {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function teamFg(box: TeamBox): string {
  return pct(box.fgm, box.fga);
}

export function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${ft}'${rem}"`;
}

export function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
