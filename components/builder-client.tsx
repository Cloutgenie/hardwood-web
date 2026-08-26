"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { presetsFor, type TeamPreset } from "@/lib/data/presets";
import { ratingColor } from "@/lib/ratings";
import { emptyTeam, saveGame } from "@/lib/matchup";
import { simulateGame, validateRoster } from "@/lib/sim/engine";
import { indexPlayers, lookupPlayer } from "@/lib/data/resolve-id";
import { assembleTeam } from "@/lib/teams";
import type { League, Player, Position, Team } from "@/lib/types";
import { PlayerCard } from "@/components/player-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

const POSITIONS: Array<Position | "ALL"> = ["ALL", "PG", "SG", "SF", "PF", "C"];

async function fetchPlayers(league: League, query: string, pos: Position | "ALL", ids?: string[]) {
  const params = new URLSearchParams({ league, limit: ids?.length ? String(ids.length) : "80" });
  if (query) params.set("q", query);
  if (pos !== "ALL") params.set("pos", pos);
  if (ids?.length) params.set("ids", ids.join(","));
  const response = await fetch(`${withBasePath("/api/players")}?${params.toString()}`);
  if (!response.ok) throw new Error("Could not load players.");
  return (await response.json()) as { poolSize: number; matched: number; players: Player[] };
}

export function BuilderClient({ league }: { league: League }) {
  const router = useRouter();
  const presets = presetsFor(league);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [side, setSide] = useState<"home" | "away">("home");
  const [home, setHome] = useState<Team>(() => emptyTeam(league, "home"));
  const [away, setAway] = useState<Team>(() => emptyTeam(league, "away"));
  const [pool, setPool] = useState<Player[]>([]);
  const [known, setKnown] = useState<Record<string, Player>>({});
  const [poolSize, setPoolSize] = useState(0);
  const [matched, setMatched] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipError, setTipError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Player | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const current = side === "home" ? home : away;
  const setCurrent = side === "home" ? setHome : setAway;

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 180);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let gone = false;
    fetchPlayers(league, debounced, pos)
      .then((data) => {
        if (gone) return;
        setPool(data.players);
        setPoolSize(data.poolSize);
        setMatched(data.matched);
        setKnown((prev) => {
          const next = { ...prev };
          for (const player of data.players) next[player.id] = player;
          return next;
        });
        setSelected((currentSelected) => currentSelected ?? data.players[0] ?? null);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (gone) return;
        setError(err instanceof Error ? err.message : "Could not load players.");
        setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [league, debounced, pos]);

  const prevLeague = useRef(league);
  useEffect(() => {
    if (prevLeague.current === league) return;
    prevLeague.current = league;
    setHome(emptyTeam(league, "home"));
    setAway(emptyTeam(league, "away"));
    setKnown({});
    setQuery("");
    setDebounced("");
    setSelected(null);
    setTipError(null);
    setSide("home");
  }, [league]);

  const knownIndex = useMemo(() => indexPlayers(known), [known]);
  const homePlayers = useMemo(
    () => home.playerIds.map((id) => lookupPlayer(knownIndex, id)).filter((player): player is Player => Boolean(player)),
    [home.playerIds, knownIndex],
  );
  const awayPlayers = useMemo(
    () => away.playerIds.map((id) => lookupPlayer(knownIndex, id)).filter((player): player is Player => Boolean(player)),
    [away.playerIds, knownIndex],
  );
  const homeErr = homePlayers.length === home.playerIds.length ? validateRoster(homePlayers) : "Loading roster…";
  const awayErr = awayPlayers.length === away.playerIds.length ? validateRoster(awayPlayers) : "Loading roster…";

  function remember(players: Player[], aliases: string[] = []) {
    setKnown((prev) => {
      const next = { ...prev };
      for (const player of players) next[player.id] = player;
      for (const [index, alias] of aliases.entries()) {
        const player = players[index];
        if (player) next[alias] = player;
      }
      return next;
    });
  }

  function addPlayer(player: Player) {
    remember([player]);
    setCurrent((team) => {
      if (team.playerIds.includes(player.id) || team.playerIds.length >= 12) return team;
      return { ...team, playerIds: [...team.playerIds, player.id] };
    });
  }

  function removePlayer(id: string, which: "home" | "away") {
    const setter = which === "home" ? setHome : setAway;
    setter((team) => ({ ...team, playerIds: team.playerIds.filter((pid) => pid !== id) }));
  }

  async function applyPreset(preset: TeamPreset) {
    try {
      const data = await fetchPlayers(league, "", "ALL", preset.playerIds);
      if (data.players.length < 8) {
        setTipError(`Could not resolve ${preset.name} — only ${data.players.length} cards found.`);
        return;
      }
      remember(data.players, preset.playerIds);
      setCurrent({
        name: preset.name,
        abbr: preset.abbr,
        league,
        playerIds: data.players.map((player) => player.id),
      });
      setTipError(null);
    } catch (err: unknown) {
      setTipError(err instanceof Error ? err.message : `Could not load ${preset.name}.`);
    }
  }

  function addButton(player: Player, wide = false) {
    const onHome = homePlayers.some((entry) => entry.id === player.id);
    const onAway = awayPlayers.some((entry) => entry.id === player.id);
    const onCurrent = side === "home" ? onHome : onAway;
    const full = current.playerIds.length >= 12;
    return (
      <Button
        className={wide ? "w-full" : undefined}
        size={wide ? "default" : "sm"}
        variant={wide ? "default" : "outline"}
        disabled={onCurrent || full}
        onClick={() => addPlayer(player)}
      >
        {onCurrent ? (side === "home" ? "On home" : "On away") : full ? "Roster full" : wide ? `Add to ${side}` : "Add"}
      </Button>
    );
  }

  function tipOff() {
    if (homeErr || awayErr) return;
    try {
      const homeTeam = assembleTeam(home, knownIndex);
      const awayTeam = assembleTeam(away, knownIndex);
      if (homeTeam.players.length < 8 || awayTeam.players.length < 8) {
        setTipError("Could not resolve every roster card. Load the preset again or re-add the players.");
        return;
      }
      const game = simulateGame(homeTeam, awayTeam, Date.now() % 1_000_000_000);
      saveGame(game);
      setTipError(null);
      router.push("/game");
    } catch (err: unknown) {
      setTipError(err instanceof Error ? err.message : "Could not tip off.");
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)]">
      <section className="min-w-0">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Player pool</p>
            <h1 className="font-heading text-2xl uppercase tracking-wide">
              {league === "nba" ? "Every NBA career" : "Every college career"}
            </h1>
          </div>
          <Badge variant="outline">{poolSize.toLocaleString()} players</Badge>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            league === "nba"
              ? "Search any NBA name — Jason Tatum, Steph, Doncic…"
              : "Search any D1 name or school — misspellings are OK"
          }
          className="mb-3"
        />
        <div className="mb-3 flex flex-wrap gap-1.5">
          {POSITIONS.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={pos === item ? "default" : "outline"}
              onClick={() => setPos(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          {loading
            ? "Loading cards…"
            : query
              ? `${matched.toLocaleString()} matches · showing ${pool.length}`
              : `Top ${pool.length} of ${poolSize.toLocaleString()} · type a name to find anyone`}
        </p>
        {error ? (
          <div className="rounded-lg border border-dashed border-destructive/40 p-8 text-center text-sm text-destructive">
            {error}
          </div>
        ) : !loading && pool.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No players match that search.
          </div>
        ) : (
          <ScrollArea className="h-[62vh] rounded-lg border border-border/70">
            <ul>
              {pool.map((player) => {
                const onHome = homePlayers.some((entry) => entry.id === player.id);
                const onAway = awayPlayers.some((entry) => entry.id === player.id);
                const onCurrent = side === "home" ? onHome : onAway;
                const full = current.playerIds.length >= 12;
                return (
                  <li key={player.id} className="flex items-center gap-3 border-b border-border/50 px-3 py-2.5 last:border-0 hover:bg-muted/40">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(player);
                        if (window.innerWidth < 1024) setSheetOpen(true);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className={cn("w-8 font-heading text-lg", ratingColor(player.ratings.overall))}>
                        {player.ratings.overall}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{player.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {player.positions.join("/")} · {player.stats.ppg.toFixed(1)} / {player.stats.rpg.toFixed(1)} /{" "}
                          {player.stats.apg.toFixed(1)} · {player.league === "college" ? player.school : player.nbaTeams}
                        </span>
                      </span>
                    </button>
                    {addButton(player)}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </section>

      <aside className="hidden min-w-0 lg:block">
        <div className="sticky top-4 rounded-xl border border-border/70 bg-card p-4">
          {selected ? (
            <PlayerCard player={selected} action={addButton(selected, true)} />
          ) : (
            <p className="text-sm text-muted-foreground">Pick a player.</p>
          )}
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        <Tabs value={side} onValueChange={(v) => setSide(v as "home" | "away")}>
          <TabsList className="w-full">
            <TabsTrigger value="home" className="flex-1">
              Home · {home.playerIds.length}
            </TabsTrigger>
            <TabsTrigger value="away" className="flex-1">
              Away · {away.playerIds.length}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-2">
          <Input
            value={current.name}
            onChange={(e) => setCurrent((t) => ({ ...t, name: e.target.value }))}
            placeholder="Team name"
          />
          <Input
            value={current.abbr}
            maxLength={4}
            onChange={(e) => setCurrent((t) => ({ ...t, abbr: e.target.value.toUpperCase() }))}
            placeholder="ABBR"
          />
        </div>

        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <Button key={preset.name} size="sm" variant="outline" onClick={() => applyPreset(preset)}>
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <RosterList
          title={side === "home" ? home.name : away.name}
          players={side === "home" ? homePlayers : awayPlayers}
          error={side === "home" ? homeErr : awayErr}
          onRemove={(id) => removePlayer(id, side)}
        />

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
          Other side: {(side === "home" ? away : home).name} ·{" "}
          {(side === "home" ? awayPlayers : homePlayers).length} players
          {(side === "home" ? awayErr : homeErr) ? ` — ${(side === "home" ? awayErr : homeErr)}` : " — ready"}
        </div>

        <Button className="w-full" size="lg" disabled={Boolean(homeErr || awayErr)} onClick={tipOff}>
          Tip off
        </Button>
        {tipError ? <p className="text-center text-xs text-destructive">{tipError}</p> : null}
        {(homeErr || awayErr) && (
          <p className="text-center text-xs text-muted-foreground">
            Both rosters need 8–12 players with two guards and frontcourt depth.
          </p>
        )}
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Player card</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{selected ? <PlayerCard player={selected} action={addButton(selected, true)} /> : null}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RosterList({
  title,
  players,
  error,
  onRemove,
}: {
  title: string;
  players: Player[];
  error: string | null;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border/70">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-xs text-muted-foreground">{players.length}/12</span>
      </div>
      {players.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted-foreground">Add players from the pool or load a preset.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {players.map((player) => (
            <li key={player.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className={cn("w-7 font-mono text-xs", ratingColor(player.ratings.overall))}>
                {player.ratings.overall}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
              <span className="text-[11px] text-muted-foreground">{player.positions[0]}</span>
              <Button size="xs" variant="ghost" onClick={() => onRemove(player.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="px-3 py-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
