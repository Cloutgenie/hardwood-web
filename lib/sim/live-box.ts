import type { GameEvent, GameResult, PlayerBox, TeamBox } from "@/lib/types";

function emptyPlayerBox(playerId: string): PlayerBox {
  return {
    playerId,
    minutes: 0,
    pts: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    orb: 0,
    drb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    plusMinus: 0,
  };
}

function emptyTeamBox(periodCount: number): TeamBox {
  return {
    score: 0,
    periodScores: Array.from({ length: periodCount }, () => 0),
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    orb: 0,
    drb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    players: {},
  };
}

function ensurePlayer(box: TeamBox, playerId: string): PlayerBox {
  const existing = box.players[playerId];
  if (existing) return existing;
  const created = emptyPlayerBox(playerId);
  box.players[playerId] = created;
  return created;
}

function seedRoster(box: TeamBox, playerIds: string[]) {
  for (const id of playerIds) ensurePlayer(box, id);
}

function applyEvent(event: GameEvent, home: TeamBox, away: TeamBox) {
  if (!event.side) return;
  const team = event.side === "home" ? home : away;
  const opp = event.side === "home" ? away : home;

  if (event.kind === "shot" && event.actorId) {
    const shooter = ensurePlayer(team, event.actorId);
    shooter.fga += 1;
    team.fga += 1;
    if (event.shotKind === "3pt") {
      shooter.fg3a += 1;
      team.fg3a += 1;
    }
    if (event.made) {
      shooter.fgm += 1;
      team.fgm += 1;
      const pts = event.points ?? (event.shotKind === "3pt" ? 3 : 2);
      shooter.pts += pts;
      if (event.shotKind === "3pt") {
        shooter.fg3m += 1;
        team.fg3m += 1;
      }
    }
    if (event.assistId) {
      ensurePlayer(team, event.assistId).ast += 1;
      team.ast += 1;
    }
    if (event.blockId) {
      ensurePlayer(opp, event.blockId).blk += 1;
      opp.blk += 1;
    }
    return;
  }

  if (event.kind === "free_throw" && event.actorId) {
    const shooter = ensurePlayer(team, event.actorId);
    shooter.fta += 1;
    team.fta += 1;
    if (event.made) {
      shooter.ftm += 1;
      team.ftm += 1;
      shooter.pts += event.points ?? 1;
    }
    return;
  }

  if (event.kind === "rebound" && event.actorId) {
    const rebounder = ensurePlayer(team, event.actorId);
    if (/offensive rebound/i.test(event.text)) {
      rebounder.orb += 1;
      team.orb += 1;
    } else {
      rebounder.drb += 1;
      team.drb += 1;
    }
    return;
  }

  if (event.kind === "turnover" && event.actorId) {
    ensurePlayer(team, event.actorId).tov += 1;
    team.tov += 1;
    if (event.stealId) {
      ensurePlayer(opp, event.stealId).stl += 1;
      opp.stl += 1;
    }
    return;
  }

  if (event.kind === "foul" && event.actorId) {
    ensurePlayer(team, event.actorId).pf += 1;
    team.pf += 1;
  }
}

export function boxesThrough(result: GameResult, events: GameEvent[]): { homeBox: TeamBox; awayBox: TeamBox } {
  const periods = Math.max(result.homeBox.periodScores.length, 1);
  const homeBox = emptyTeamBox(periods);
  const awayBox = emptyTeamBox(periods);
  seedRoster(homeBox, result.home.playerIds);
  seedRoster(awayBox, result.away.playerIds);
  for (const event of events) applyEvent(event, homeBox, awayBox);
  homeBox.score = Object.values(homeBox.players).reduce((sum, row) => sum + row.pts, 0);
  awayBox.score = Object.values(awayBox.players).reduce((sum, row) => sum + row.pts, 0);
  return { homeBox, awayBox };
}

export function projectLive(result: GameResult, cursor: number) {
  const events = result.events.slice(0, Math.max(0, cursor + 1));
  const last = events[events.length - 1];
  const finished = last?.kind === "final" || cursor >= result.events.length - 1;
  if (finished) {
    return { events, homeBox: result.homeBox, awayBox: result.awayBox, finished: true as const };
  }
  const boxes = boxesThrough(result, events);
  return { events, ...boxes, finished: false as const };
}
