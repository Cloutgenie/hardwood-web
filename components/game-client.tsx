"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { minutesLabel, pct } from "@/lib/format";
import { loadGame, readGameRaw, subscribeGame } from "@/lib/matchup";
import { projectLive } from "@/lib/sim/live-box";
import { formatClock, periodLabel } from "@/lib/sim/rules";
import type { GameEvent, GameResult, PlayerBox, Side, TeamBox } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export function GameClient() {
  const raw = useSyncExternalStore(subscribeGame, readGameRaw, () => null);
  const result = useMemo(() => (raw ? loadGame() : null), [raw]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState("pbp");

  useEffect(() => {
    if (!result || !playing) return;
    const id = window.setInterval(() => {
      setCursor((c) => {
        if (c >= result.events.length - 1) {
          setPlaying(false);
          return result.events.length - 1;
        }
        return c + 1;
      });
    }, speed === 2 ? 90 : speed === 0.5 ? 420 : 180);
    return () => window.clearInterval(id);
  }, [result, playing, speed]);

  const live = useMemo(() => {
    if (!result) return null;
    return projectLive(result, cursor);
  }, [result, cursor]);

  if (!raw) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-heading text-2xl uppercase">No matchup loaded. Build two teams first.</p>
        <Button asChild className="mt-4">
          <Link href="/build?league=nba">Build teams</Link>
        </Button>
      </div>
    );
  }

  if (!result || !live) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-muted-foreground">
        Tipping off…
      </div>
    );
  }

  const last = live.events[live.events.length - 1];
  const finished = live.finished;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <Scoreboard result={result} last={last} finished={finished} homeBox={live.homeBox} awayBox={live.awayBox} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!playing && cursor >= result.events.length - 1) {
                setCursor(0);
                setPlaying(true);
                setTab("pbp");
                return;
              }
              setPlaying((p) => !p);
            }}
          >
            {playing ? "Pause" : finished ? "Replay" : "Play"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setPlaying(false);
              setCursor(result.events.length - 1);
              setTab("box");
            }}
          >
            Skip to final
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setCursor(0);
              setPlaying(true);
              setTab("pbp");
            }}
          >
            Restart
          </Button>
          <div className="flex gap-1">
            {[0.5, 1, 2].map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={speed === value ? "default" : "outline"}
                onClick={() => setSpeed(value)}
              >
                {value}x
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Seed {result.seed}</p>
        </div>
        <Link
          href={`/build?league=${result.league}`}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Edit rosters
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pbp">Play-by-play</TabsTrigger>
            <TabsTrigger value="box">Full box</TabsTrigger>
          </TabsList>
          <TabsContent value="pbp">
            <ScrollArea className="h-[62vh] rounded-xl border border-border/70 bg-card">
              {live.events.length > 80 ? (
                <p className="px-3 py-2 text-[11px] text-muted-foreground">
                  Showing the last 80 of {live.events.length} plays. Skip to final opens the full box.
                </p>
              ) : null}
              <ol className="divide-y divide-border/40">
                {live.events
                  .slice(-80)
                  .reverse()
                  .map((event) => (
                    <li
                      key={event.id}
                      className={cn(
                        "px-3 py-2 text-sm",
                        event.kind === "shot" && event.made && "bg-primary/5",
                        event.kind === "final" && "bg-muted/40 font-medium",
                      )}
                    >
                      <p>{event.text}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {result.home.abbr} {event.homeScore} · {result.away.abbr} {event.awayScore}
                      </p>
                    </li>
                  ))}
              </ol>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="box">
            <div className="space-y-4">
              {!finished ? (
                <p className="text-xs text-muted-foreground">
                  Box score through the current play. Minutes and plus-minus post when the game ends.
                </p>
              ) : null}
              <BoxTable side="home" result={result} box={live.homeBox} finished={finished} />
              <BoxTable side="away" result={result} box={live.awayBox} finished={finished} />
            </div>
          </TabsContent>
        </Tabs>

        <aside className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {finished ? "Final snapshot" : "Live snapshot"}
          </p>
          <TeamSnap label={result.home.name} abbr={result.home.abbr} box={live.homeBox} />
          <TeamSnap label={result.away.name} abbr={result.away.abbr} box={live.awayBox} />
          {last ? (
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last play</p>
              <p className="mt-1 text-sm leading-relaxed">{last.text}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Scoreboard({
  result,
  last,
  finished,
  homeBox,
  awayBox,
}: {
  result: GameResult;
  last?: GameEvent;
  finished: boolean;
  homeBox: TeamBox;
  awayBox: TeamBox;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(160deg,oklch(0.2_0.03_80),oklch(0.16_0.02_250)_55%,oklch(0.13_0.02_250))] p-5">
      <div className="mb-3 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-primary">
        <span>{result.league === "nba" ? "NBA rules · 48:00" : "College rules · 40:00"}</span>
        <span>{finished ? "Final" : last ? `${periodLabel(result.league, last.period)} ${formatClock(last.clock)}` : "Tip"}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamScore name={result.home.name} abbr={result.home.abbr} score={last?.homeScore ?? 0} align="left" winner={result.winner === "home" && finished} />
        <p className="font-heading text-xl text-muted-foreground">VS</p>
        <TeamScore name={result.away.name} abbr={result.away.abbr} score={last?.awayScore ?? 0} align="right" winner={result.winner === "away" && finished} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground sm:grid-cols-4">
        <span>
          {result.home.abbr} FG {pct(homeBox.fgm, homeBox.fga)}
        </span>
        <span>
          {result.away.abbr} FG {pct(awayBox.fgm, awayBox.fga)}
        </span>
        <span>
          {result.home.abbr} 3P {pct(homeBox.fg3m, homeBox.fg3a)}
        </span>
        <span>
          {result.away.abbr} 3P {pct(awayBox.fg3m, awayBox.fg3a)}
        </span>
      </div>
    </div>
  );
}

function TeamScore({
  name,
  abbr,
  score,
  align,
  winner,
}: {
  name: string;
  abbr: string;
  score: number;
  align: "left" | "right";
  winner: boolean;
}) {
  return (
    <div className={cn(align === "right" && "text-right")}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{name}</p>
      <p className={cn("font-heading text-5xl sm:text-6xl", winner && "text-primary")}>{score}</p>
      <p className="text-sm text-muted-foreground">{abbr}</p>
    </div>
  );
}

function TeamSnap({
  label,
  abbr,
  box,
}: {
  label: string;
  abbr: string;
  box: GameResult["homeBox"];
}) {
  return (
    <div>
      <p className="font-medium">
        {label} <span className="text-muted-foreground">({abbr})</span>
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        {box.fgm}-{box.fga} FG · {box.fg3m}-{box.fg3a} 3P · {box.ftm}-{box.fta} FT · {box.ast} AST · {box.tov} TO ·{" "}
        {box.orb + box.drb} REB
      </p>
    </div>
  );
}

function BoxTable({
  side,
  result,
  box,
  finished,
}: {
  side: Side;
  result: GameResult;
  box: TeamBox;
  finished: boolean;
}) {
  const team = side === "home" ? result.home : result.away;
  const teamBox = box;
  const rows = Object.values(box.players)
    .filter((row) =>
      finished
        ? row.minutes > 0 || row.pts > 0
        : row.pts + row.fga + row.fta + row.orb + row.drb + row.ast + row.stl + row.blk + row.tov + row.pf > 0,
    )
    .sort((a, b) => b.pts - a.pts || b.minutes - a.minutes);

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70">
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{team.abbr}</th>
            <th className="px-2 py-2">MIN</th>
            <th className="px-2 py-2">PTS</th>
            <th className="px-2 py-2">REB</th>
            <th className="px-2 py-2">AST</th>
            <th className="px-2 py-2">STL</th>
            <th className="px-2 py-2">BLK</th>
            <th className="px-2 py-2">TO</th>
            <th className="px-2 py-2">FG</th>
            <th className="px-2 py-2">3P</th>
            <th className="px-2 py-2">FT</th>
            <th className="px-2 py-2">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((box) => {
            const player = [...result.home.players, ...result.away.players].find((p) => p.id === box.playerId);
            return (
              <tr key={box.playerId} className="border-t border-border/40">
                <td className="px-3 py-1.5 font-medium">{player?.name ?? box.playerId}</td>
                <td className="px-2 py-1.5 font-mono">{finished ? minutesLabel(box.minutes) : "—"}</td>
                <td className="px-2 py-1.5 font-mono">{box.pts}</td>
                <td className="px-2 py-1.5 font-mono">{box.orb + box.drb}</td>
                <td className="px-2 py-1.5 font-mono">{box.ast}</td>
                <td className="px-2 py-1.5 font-mono">{box.stl}</td>
                <td className="px-2 py-1.5 font-mono">{box.blk}</td>
                <td className="px-2 py-1.5 font-mono">{box.tov}</td>
                <td className="px-2 py-1.5 font-mono">
                  {box.fgm}-{box.fga}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {box.fg3m}-{box.fg3a}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {box.ftm}-{box.fta}
                </td>
                <td className="px-2 py-1.5 font-mono">
                  {finished ? (box.plusMinus > 0 ? `+${box.plusMinus}` : box.plusMinus) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-muted/20 font-medium">
            <td className="px-3 py-2">Team</td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2 font-mono">{teamBox.score}</td>
            <td className="px-2 py-2 font-mono">{teamBox.orb + teamBox.drb}</td>
            <td className="px-2 py-2 font-mono">{teamBox.ast}</td>
            <td className="px-2 py-2 font-mono">{teamBox.stl}</td>
            <td className="px-2 py-2 font-mono">{teamBox.blk}</td>
            <td className="px-2 py-2 font-mono">{teamBox.tov}</td>
            <td className="px-2 py-2 font-mono">
              {teamBox.fgm}-{teamBox.fga}
            </td>
            <td className="px-2 py-2 font-mono">
              {teamBox.fg3m}-{teamBox.fg3a}
            </td>
            <td className="px-2 py-2 font-mono">
              {teamBox.ftm}-{teamBox.fta}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

