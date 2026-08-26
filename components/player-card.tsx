"use client";

import type { ReactNode } from "react";
import { formatHeight, formatPct } from "@/lib/format";
import { RATING_GROUPS, ratingColor, ratingLabel } from "@/lib/ratings";
import type { Player } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PlayerCard({
  player,
  action,
}: {
  player: Player;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-2xl tracking-wide uppercase">{player.name}</p>
          <p className="text-sm text-muted-foreground">
            {player.positions.join(" / ")} · {formatHeight(player.heightIn)} · {player.weightLb} lb
          </p>
          <p className="text-xs text-muted-foreground">
            {player.league === "college" ? player.school : player.nbaTeams} · {player.years}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("font-heading text-4xl", ratingColor(player.ratings.overall))}>
            {player.ratings.overall}
          </p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {ratingLabel(player.ratings.overall)} OVR
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-center text-xs">
        <Stat label="PTS" value={player.stats.ppg.toFixed(1)} />
        <Stat label="REB" value={player.stats.rpg.toFixed(1)} />
        <Stat label="AST" value={player.stats.apg.toFixed(1)} />
        <Stat label="MPG" value={player.stats.mpg.toFixed(1)} />
        <Stat label="FG%" value={formatPct(player.stats.fgPct)} />
        <Stat label="3P%" value={formatPct(player.stats.fg3Pct)} />
        <Stat label="FT%" value={formatPct(player.stats.ftPct)} />
        <Stat label="STL/BLK" value={`${player.stats.spg.toFixed(1)} / ${player.stats.bpg.toFixed(1)}`} />
      </div>

      <div className="space-y-3">
        {RATING_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {group.keys.map(({ key, label }) => (
                <RatingRow key={key} label={label} value={player.ratings[key]} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {player.note ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{player.note}</p>
      ) : null}

      <Badge variant="outline" className="font-normal">
        Rated from {player.league === "college" ? "college" : "NBA"} career only
      </Badge>
      {action}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-sm text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function RatingRow({ label, value }: { label: string; value: number }) {
  const width = ((value - 20) / 60) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
      <span className={cn("w-6 text-right font-mono text-xs", ratingColor(value))}>{value}</span>
    </div>
  );
}
