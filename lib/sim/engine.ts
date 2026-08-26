import type {
  BuiltTeam,
  GameEvent,
  GameResult,
  League,
  LeagueRules,
  PlayType,
  Player,
  PlayerBox,
  Position,
  Side,
  TeamBox,
} from "@/lib/types";
import { primaryPosition } from "@/lib/ratings";
import { between, chance, createRng, weightedPick } from "@/lib/sim/rng";
import { LEAGUE_RULES, formatClock, periodLabel } from "@/lib/sim/rules";

interface LivePlayer {
  player: Player;
  onCourt: boolean;
  fatigue: number;
  minutes: number;
  targetMinutes: number;
  fouls: number;
  box: PlayerBox;
}

interface LiveTeam {
  built: BuiltTeam;
  side: Side;
  players: LivePlayer[];
  box: TeamBox;
  periodFouls: number;
}

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

function ratingPct(rating: number, avg: number, elite: number): number {
  const t = (rating - 20) / 60;
  return avg + (elite - avg) * (t - 0.5) * 2 * 0.72;
}

function lastName(name: string): string {
  const parts = name.split(" ");
  return parts[parts.length - 1] ?? name;
}

function groupOf(pos: Position): "G" | "F" | "C" {
  if (pos === "PG" || pos === "SG") return "G";
  if (pos === "C") return "C";
  return "F";
}

function starterIds(players: Player[]): string[] {
  const used = new Set<string>();
  const picks: string[] = [];
  const order: Position[] = ["PG", "SG", "SF", "PF", "C"];

  for (const pos of order) {
    const candidate = players
      .filter((p) => !used.has(p.id) && p.positions.includes(pos))
      .sort((a, b) => b.ratings.overall - a.ratings.overall)[0];
    if (candidate) {
      used.add(candidate.id);
      picks.push(candidate.id);
    }
  }

  const rest = players
    .filter((p) => !used.has(p.id))
    .sort((a, b) => b.ratings.overall - a.ratings.overall);
  for (const player of rest) {
    if (picks.length >= 5) break;
    picks.push(player.id);
  }
  return picks.slice(0, 5);
}

export function fillStarters(team: BuiltTeam): string[] {
  if (team.starters.length === 5) return team.starters;
  return starterIds(team.players);
}

function makeLiveTeam(built: BuiltTeam, side: Side, rules: LeagueRules): LiveTeam {
  const starters = new Set(fillStarters(built));
  const gameMinutes = rules.periods * rules.periodMinutes;
  const scale = gameMinutes / (rules.league === "nba" ? 48 : 40);
  const players = built.players.map((player) => {
    const isStarter = starters.has(player.id);
    const target = Math.min(
      gameMinutes - 2,
      Math.max(8, player.stats.mpg * scale * (isStarter ? 1.05 : 0.92)),
    );
    const box = emptyPlayerBox(player.id);
    return {
      player,
      onCourt: isStarter,
      fatigue: 0,
      minutes: 0,
      targetMinutes: target,
      fouls: 0,
      box,
    };
  });

  if (players.filter((p) => p.onCourt).length < 5) {
    for (const live of players.sort((a, b) => b.player.ratings.overall - a.player.ratings.overall)) {
      if (players.filter((p) => p.onCourt).length >= 5) break;
      live.onCourt = true;
    }
  }

  const box = emptyTeamBox(rules.periods);
  for (const live of players) box.players[live.player.id] = live.box;
  return { built, side, players, box, periodFouls: 0 };
}

function onCourt(team: LiveTeam): LivePlayer[] {
  return team.players.filter((p) => p.onCourt);
}

function liveById(team: LiveTeam, id: string): LivePlayer | undefined {
  return team.players.find((p) => p.player.id === id);
}

function available(team: LiveTeam, period: number, rules: LeagueRules): LivePlayer[] {
  return team.players.filter((p) => {
    const q1Limit = rules.league === "nba" && period === 1 ? 3 : 99;
    return p.fouls < rules.dqFouls && p.fouls < q1Limit;
  });
}

function maybeSubstitute(
  team: LiveTeam,
  period: number,
  clock: number,
  rules: LeagueRules,
  rng: () => number,
  _events: GameEvent[],
  push: (partial: Omit<GameEvent, "id" | "homeScore" | "awayScore"> & { homeScore?: number; awayScore?: number }) => void,
  scores: { home: number; away: number },
) {
  const court = onCourt(team);
  const bench = available(team, period, rules).filter((p) => !p.onCourt);
  if (bench.length === 0) return;

  const lateClose = period >= rules.periods && clock < 180;

  for (const man of court) {
    const tired = man.minutes > man.targetMinutes + 2 || man.fatigue > 0.72;
    const foulTrouble = man.fouls >= rules.dqFouls - 2 && clock > 240 && period <= rules.periods;
    const blowoutRest = Math.abs(scores.home - scores.away) >= 22 && man.minutes > man.targetMinutes * 0.7;
    if (!(tired || foulTrouble || blowoutRest) && !chance(rng, 0.04)) continue;
    if (lateClose && man.player.ratings.overall >= 68) continue;

    const need = groupOf(primaryPosition(man.player.positions));
    const replacement =
      bench
        .filter((b) => groupOf(primaryPosition(b.player.positions)) === need)
        .sort((a, b) => {
          const aOver = a.minutes - a.targetMinutes;
          const bOver = b.minutes - b.targetMinutes;
          return aOver - bOver || b.player.ratings.overall - a.player.ratings.overall;
        })[0] ?? bench.sort((a, b) => a.minutes - b.minutes)[0];

    if (!replacement) continue;
    man.onCourt = false;
    man.fatigue = Math.max(0, man.fatigue - 0.22);
    replacement.onCourt = true;
    const idx = bench.indexOf(replacement);
    if (idx >= 0) bench.splice(idx, 1);
    push({
      period,
      clock,
      kind: "sub",
      side: team.side,
      actorId: replacement.player.id,
      text: `${periodLabel(rules.league, period)} ${formatClock(clock)} — ${lastName(replacement.player.name)} in for ${lastName(man.player.name)}.`,
      homeScore: scores.home,
      awayScore: scores.away,
    });
  }
}

function tickMinutes(team: LiveTeam, seconds: number) {
  const min = seconds / 60;
  for (const man of onCourt(team)) {
    man.minutes += min;
    man.box.minutes += min;
    man.fatigue = Math.min(1, man.fatigue + min / Math.max(8, man.player.ratings.stamina / 6));
  }
  for (const man of team.players) {
    if (!man.onCourt) man.fatigue = Math.max(0, man.fatigue - min * 0.08);
  }
}

function applyPlusMinus(offense: LiveTeam, defense: LiveTeam, points: number) {
  for (const man of onCourt(offense)) man.box.plusMinus += points;
  for (const man of onCourt(defense)) man.box.plusMinus -= points;
}

function addScore(team: LiveTeam, period: number, points: number, rules: LeagueRules) {
  team.box.score += points;
  const idx = Math.min(team.box.periodScores.length - 1, period - 1);
  if (period > rules.periods) {
    while (team.box.periodScores.length < period) team.box.periodScores.push(0);
  }
  team.box.periodScores[idx] = (team.box.periodScores[idx] ?? 0) + points;
}

function matchupDefender(defense: LiveTeam, shooter: Player, rng: () => number): LivePlayer {
  const court = onCourt(defense);
  const want = groupOf(primaryPosition(shooter.positions));
  const same = court.filter((p) => groupOf(primaryPosition(p.player.positions)) === want);
  const pool = same.length ? same : court;
  return weightedPick(rng, pool, (p) => {
    const d =
      want === "C"
        ? p.player.ratings.interiorD
        : p.player.ratings.perimeterD;
    return d * (1 - p.fatigue * 0.25);
  });
}

function choosePlay(
  offense: LiveTeam,
  _defense: LiveTeam,
  transition: boolean,
  rng: () => number,
): { play: PlayType; initiator: LivePlayer; shooter: LivePlayer } {
  const court = onCourt(offense);
  const initiator = weightedPick(
    rng,
    court,
    (p) =>
      (p.player.ratings.usage * 1.1 + p.player.ratings.handle * 0.5 + p.player.ratings.pass * 0.4) *
      (1 - p.fatigue * 0.35),
  );

  if (transition) {
    const finisher = weightedPick(
      rng,
      court,
      (p) => p.player.ratings.speed * 0.6 + p.player.ratings.finish * 0.7 + p.player.ratings.three * 0.25,
    );
    return { play: "transition", initiator, shooter: finisher };
  }

  const bigs = court.filter((p) => {
    const pos = primaryPosition(p.player.positions);
    return pos === "C" || pos === "PF";
  });
  const wings = court.filter((p) => p.player.ratings.three >= 58);

  const weights: { play: PlayType; w: number; shooter: () => LivePlayer }[] = [
    {
      play: "isolation",
      w: Math.max(4, initiator.player.ratings.usage - 48 + initiator.player.ratings.handle - 50),
      shooter: () => initiator,
    },
    {
      play: "pnr_handler",
      w: initiator.player.ratings.handle * 0.4 + initiator.player.ratings.three * 0.25 + (bigs.length ? 12 : 2),
      shooter: () => initiator,
    },
    {
      play: "pnr_roll",
      w: bigs.length ? 10 + Math.max(...bigs.map((b) => b.player.ratings.finish - 48)) : 1,
      shooter: () => (bigs.length ? weightedPick(rng, bigs, (b) => b.player.ratings.finish) : initiator),
    },
    {
      play: "pnr_pop",
      w: bigs.some((b) => b.player.ratings.three >= 58) ? 14 : 2,
      shooter: () =>
        weightedPick(
          rng,
          bigs.length ? bigs : court,
          (b) => b.player.ratings.three,
        ),
    },
    {
      play: "post",
      w: bigs.length ? 8 + Math.max(...bigs.map((b) => b.player.ratings.strength + b.player.ratings.finish - 100)) : 2,
      shooter: () => (bigs.length ? weightedPick(rng, bigs, (b) => b.player.ratings.strength + b.player.ratings.finish) : initiator),
    },
    {
      play: "spot_up",
      w: wings.length ? 10 + wings.length * 4 : 5,
      shooter: () => (wings.length ? weightedPick(rng, wings, (w) => w.player.ratings.three) : initiator),
    },
    {
      play: "cut",
      w: 8 + (onCourt(_defense).reduce((s, p) => s + p.player.ratings.iq, 0) < 260 ? 6 : 0),
      shooter: () => weightedPick(rng, court, (p) => p.player.ratings.finish + p.player.ratings.speed * 0.4),
    },
  ];

  const chosen = weightedPick(rng, weights, (row) => Math.max(1, row.w));
  return { play: chosen.play, initiator, shooter: chosen.shooter() };
}

function threeChance(play: PlayType, shooter: Player, trailingLate: boolean): number {
  const volume = shooter.stats.fg3Rate;
  let p = volume * 0.85;
  if (play === "spot_up" || play === "pnr_pop") p += 0.22;
  if (play === "pnr_handler") p += 0.12;
  if (play === "isolation") p += 0.06;
  if (play === "transition") p += 0.08;
  if (play === "post" || play === "pnr_roll" || play === "cut" || play === "putback") p *= 0.15;
  if (shooter.ratings.three < 40) p *= 0.25;
  if (trailingLate) p += 0.18;
  return Math.max(0.02, Math.min(0.72, p));
}

function shotMakeProb(
  play: PlayType,
  isThree: boolean,
  shooter: LivePlayer,
  defender: LivePlayer,
  contested: boolean,
): number {
  const r = shooter.player.ratings;
  const d = defender.player.ratings;
  const tired = shooter.fatigue * 0.045;
  if (isThree) {
    let p = ratingPct(r.three, 0.345, 0.43);
    p -= (d.perimeterD - 50) * 0.0018;
    if (contested) p -= 0.055;
    else p += 0.035;
    if (play === "spot_up") p += 0.015;
    if (play === "transition") p -= 0.01;
    return Math.max(0.18, Math.min(0.55, p - tired));
  }

  const atRim = play === "pnr_roll" || play === "cut" || play === "putback" || play === "transition" || play === "post";
  const skill = atRim ? r.finish : r.midRange;
  let p = ratingPct(skill, atRim ? 0.56 : 0.43, atRim ? 0.72 : 0.54);
  p -= ((atRim ? d.interiorD : d.perimeterD) - 50) * 0.002;
  if (contested) p -= atRim ? 0.06 : 0.05;
  else p += 0.04;
  if (play === "post") p += (r.strength - d.strength) * 0.0012;
  if (play === "transition") p += 0.07;
  return Math.max(0.22, Math.min(0.8, p - tired));
}

function playVerb(play: PlayType, isThree: boolean): string {
  switch (play) {
    case "transition":
      return isThree ? "launches a transition three" : "attacks in transition";
    case "isolation":
      return isThree ? "steps into an isolation three" : "creates off the bounce";
    case "pnr_handler":
      return isThree ? "pulls up from the pick" : "comes off the pick and rolls downhill";
    case "pnr_roll":
      return "finishes on the roll";
    case "pnr_pop":
      return "pops to the three-point line";
    case "post":
      return "backs down on the block";
    case "spot_up":
      return isThree ? "lets a spot-up three go" : "knocks down a catch-and-shoot two";
    case "cut":
      return "cuts to the rim";
    case "putback":
      return "goes back up with the offensive rebound";
    case "oreb_kick":
      return isThree ? "kicks it out for three" : "kicks it out for a two";
  }
}

export function simulateGame(home: BuiltTeam, away: BuiltTeam, seed = Date.now() % 1_000_000_000): GameResult {
  if (home.league !== away.league) {
    throw new Error("Both teams must be from the same league.");
  }
  const league: League = home.league;
  const rules = LEAGUE_RULES[league];
  const rng = createRng(seed);

  if (home.players.length < 5 || away.players.length < 5) {
    throw new Error("Both teams need five players on the floor to tip off.");
  }
  const liveHome = makeLiveTeam(home, "home", rules);
  const liveAway = makeLiveTeam(away, "away", rules);
  if (onCourt(liveHome).length < 5 || onCourt(liveAway).length < 5) {
    throw new Error("Both teams need five players on the floor to tip off.");
  }
  const sides: Record<Side, LiveTeam> = { home: liveHome, away: liveAway };

  const events: GameEvent[] = [];
  let eventId = 0;
  let homeScore = 0;
  let awayScore = 0;

  const push = (
    partial: Omit<GameEvent, "id" | "homeScore" | "awayScore"> & {
      homeScore?: number;
      awayScore?: number;
    },
  ) => {
    const event: GameEvent = {
      id: eventId++,
      homeScore,
      awayScore,
      ...partial,
    };
    events.push(event);
  };

  let period = 1;
  let clock = rules.periodMinutes * 60;
  let possession: Side = chance(rng, 0.5) ? "home" : "away";
  let transition = false;
  let extraPossession: Side | null = null;

  const tipWinner = possession;
  const tipPlayer = weightedPick(
    rng,
    onCourt(sides[tipWinner]),
    (p) => p.player.ratings.vertical + p.player.heightIn,
  );
  push({
    period,
    clock,
    kind: "tip",
    side: tipWinner,
    actorId: tipPlayer.player.id,
    text: `${tipPlayer.player.name} wins the tip for ${sides[tipWinner].built.abbr}.`,
  });

  const maxPeriods = rules.periods + 5;

  const inBonus = (team: LiveTeam) => team.periodFouls >= rules.bonusFouls;
  const inDouble = (team: LiveTeam) =>
    rules.doubleBonusFouls != null && team.periodFouls >= rules.doubleBonusFouls;

  while (period <= maxPeriods) {
    const periodLen = (period > rules.periods ? rules.otMinutes : rules.periodMinutes) * 60;
    if (clock <= 0) {
      push({
        period,
        clock: 0,
        kind: "period",
        text: `End of ${periodLabel(league, period)}. ${home.abbr} ${homeScore}, ${away.abbr} ${awayScore}.`,
      });
      if (period >= rules.periods && homeScore !== awayScore) break;
      period += 1;
      clock = period > rules.periods ? rules.otMinutes * 60 : periodLen;
      liveHome.periodFouls = 0;
      liveAway.periodFouls = 0;
      if (period > maxPeriods) break;
      if (period > rules.periods && homeScore === awayScore) {
        possession = chance(rng, 0.5) ? "home" : "away";
        push({
          period,
          clock,
          kind: "period",
          text: `${periodLabel(league, period)} — ${sides[possession].built.abbr} gets the ball first.`,
        });
      }
      continue;
    }

    const offense: LiveTeam = sides[extraPossession ?? possession];
    const defense: LiveTeam = sides[offense.side === "home" ? "away" : "home"];
    extraPossession = null;

    maybeSubstitute(offense, period, clock, rules, rng, events, push, { home: homeScore, away: awayScore });
    maybeSubstitute(defense, period, clock, rules, rng, events, push, { home: homeScore, away: awayScore });

    const trailingLate =
      period >= rules.periods &&
      clock < 90 &&
      (offense.side === "home" ? homeScore : awayScore) + 4 <
        (offense.side === "home" ? awayScore : homeScore);

    const used = Math.min(
      clock,
      between(rng, transition ? 4 : 8, Math.min(rules.shotClock - 1, transition ? 11 : rules.shotClock - 2)),
    );
    clock -= used;
    tickMinutes(liveHome, used);
    tickMinutes(liveAway, used);

    const { play, initiator, shooter } = choosePlay(offense, defense, transition, rng);
    transition = false;

    const defOnBall = matchupDefender(defense, initiator.player, rng);
    const stealChance =
      0.035 +
      (defOnBall.player.ratings.steal - 50) * 0.0011 +
      (50 - initiator.player.ratings.handle) * 0.001 -
      initiator.player.ratings.iq * 0.0003;
    if (chance(rng, Math.max(0.015, Math.min(0.11, stealChance)))) {
      initiator.box.tov += 1;
      offense.box.tov += 1;
      defOnBall.box.stl += 1;
      defense.box.stl += 1;
      possession = defense.side;
      transition = true;
      push({
        period,
        clock,
        kind: "turnover",
        side: offense.side,
        playType: play,
        actorId: initiator.player.id,
        stealId: defOnBall.player.id,
        text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(defOnBall.player.name)} steals it from ${lastName(initiator.player.name)}.`,
      });
      continue;
    }

    const liveTo = 0.07 + (50 - initiator.player.ratings.handle) * 0.0012 + (50 - initiator.player.ratings.iq) * 0.0008;
    if (chance(rng, Math.max(0.03, Math.min(0.14, liveTo)))) {
      initiator.box.tov += 1;
      offense.box.tov += 1;
      possession = defense.side;
      push({
        period,
        clock,
        kind: "turnover",
        side: offense.side,
        playType: play,
        actorId: initiator.player.id,
        text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(initiator.player.name)} turns it over.`,
      });
      continue;
    }

    if (chance(rng, 0.035)) {
      const hacker = matchupDefender(defense, initiator.player, rng);
      hacker.box.pf += 1;
      hacker.fouls += 1;
      defense.box.pf += 1;
      defense.periodFouls += 1;
      const bonus = inDouble(defense) || (inBonus(defense) && !rules.oneAndOne);
      const oneAndOne = inBonus(defense) && rules.oneAndOne && !inDouble(defense);
      push({
        period,
        clock,
        kind: "foul",
        side: defense.side,
        actorId: hacker.player.id,
        text: `${periodLabel(league, period)} ${formatClock(clock)} — Common foul, ${lastName(hacker.player.name)}.${bonus || oneAndOne ? " Bonus." : ""}`,
      });
      if (bonus) {
        shootFts(offense, defense, initiator, 2, period, clock, rules, rng, push, league);
        homeScore = liveHome.box.score;
        awayScore = liveAway.box.score;
        possession = defense.side;
      } else if (oneAndOne) {
        const first = chance(rng, ratingPct(initiator.player.ratings.freeThrow, 0.76, 0.93));
        initiator.box.fta += 1;
        offense.box.fta += 1;
        if (first) {
          initiator.box.ftm += 1;
          offense.box.ftm += 1;
          initiator.box.pts += 1;
          addScore(offense, period, 1, rules);
          applyPlusMinus(offense, defense, 1);
          shootFts(offense, defense, initiator, 1, period, clock, rules, rng, push, league);
        } else {
          push({
            period,
            clock,
            kind: "free_throw",
            side: offense.side,
            actorId: initiator.player.id,
            made: false,
            points: 0,
            shotKind: "ft",
            text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(initiator.player.name)} misses the front end of the 1-and-1.`,
            homeScore: 0,
            awayScore: 0,
          });
        }
        homeScore = liveHome.box.score;
        awayScore = liveAway.box.score;
        possession = defense.side;
      } else {
        extraPossession = offense.side;
      }
      continue;
    }

    const defender = matchupDefender(defense, shooter.player, rng);
    const isThree = chance(rng, threeChance(play, shooter.player, trailingLate));
    const contested = chance(
      rng,
      0.42 + (defender.player.ratings.perimeterD - 50) * 0.004 - (shooter.player.ratings.iq - 50) * 0.002,
    );

    const blockChance =
      (isThree ? 0.008 : 0.035) +
      (defender.player.ratings.block - 50) * 0.0014 +
      (play === "pnr_roll" || play === "cut" || play === "post" ? 0.02 : 0);
    if (chance(rng, Math.max(0.004, Math.min(0.12, blockChance)))) {
      shooter.box.fga += 1;
      offense.box.fga += 1;
      if (isThree) {
        shooter.box.fg3a += 1;
        offense.box.fg3a += 1;
      }
      defender.box.blk += 1;
      defense.box.blk += 1;
      const kept = chance(rng, 0.28);
      possession = kept ? offense.side : defense.side;
      transition = !kept;
      push({
        period,
        clock,
        kind: "shot",
        side: offense.side,
        playType: play,
        actorId: shooter.player.id,
        defenderId: defender.player.id,
        blockId: defender.player.id,
        made: false,
        shotKind: isThree ? "3pt" : "2pt",
        contested: true,
        text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(shooter.player.name)} ${playVerb(play, isThree)}. BLOCKED by ${lastName(defender.player.name)}.`,
      });
      continue;
    }

    const shootingFoul = chance(
      rng,
      0.09 +
        shooter.player.stats.ftaRate * 0.12 +
        (play === "pnr_roll" || play === "cut" || play === "transition" ? 0.05 : 0) -
        (defender.player.ratings.iq - 50) * 0.0008,
    );

    if (shootingFoul) {
      defender.box.pf += 1;
      defender.fouls += 1;
      defense.box.pf += 1;
      defense.periodFouls += 1;
      const andOne = chance(rng, shotMakeProb(play, isThree, shooter, defender, true) * 0.22);
      if (andOne) {
        const pts = isThree ? 3 : 2;
        resolveMake(offense, defense, shooter, initiator, play, isThree, contested, pts, period, clock, rules, rng, push, league);
        if (offense.side === "home") homeScore += pts;
        else awayScore += pts;
        events[events.length - 1]!.homeScore = homeScore;
        events[events.length - 1]!.awayScore = awayScore;
        const madeFt = chance(rng, ratingPct(shooter.player.ratings.freeThrow, 0.76, 0.92));
        shooter.box.fta += 1;
        offense.box.fta += 1;
        if (madeFt) {
          shooter.box.ftm += 1;
          offense.box.ftm += 1;
          shooter.box.pts += 1;
          addScore(offense, period, 1, rules);
          applyPlusMinus(offense, defense, 1);
          if (offense.side === "home") homeScore += 1;
          else awayScore += 1;
        }
        push({
          period,
          clock,
          kind: "free_throw",
          side: offense.side,
          actorId: shooter.player.id,
          made: madeFt,
          points: madeFt ? 1 : 0,
          shotKind: "ft",
          text: `${periodLabel(league, period)} ${formatClock(clock)} — And-1 ${lastName(shooter.player.name)} ${madeFt ? "hits" : "misses"} the free throw.`,
        });
        possession = defense.side;
      } else {
        const fts = isThree ? 3 : 2;
        shootFts(offense, defense, shooter, fts, period, clock, rules, rng, push, league);
        homeScore = liveHome.box.score;
        awayScore = liveAway.box.score;
        if (events[events.length - 1]?.made === false && chance(rng, 0.22)) {
          extraPossession = offense.side;
        } else {
          possession = defense.side;
        }
      }
      continue;
    }

    const makeP = shotMakeProb(play, isThree, shooter, defender, contested);
    const made = chance(rng, makeP);
    const pts = isThree ? 3 : 2;
    shooter.box.fga += 1;
    offense.box.fga += 1;
    if (isThree) {
      shooter.box.fg3a += 1;
      offense.box.fg3a += 1;
    }

    if (made) {
      resolveMake(offense, defense, shooter, initiator, play, isThree, contested, pts, period, clock, rules, rng, push, league);
      if (offense.side === "home") homeScore += pts;
      else awayScore += pts;
      events[events.length - 1]!.homeScore = homeScore;
      events[events.length - 1]!.awayScore = awayScore;
      possession = defense.side;
      continue;
    }

    const contestBit = contested ? ` Contested by ${lastName(defender.player.name)}.` : " Wide open.";
    push({
      period,
      clock,
      kind: "shot",
      side: offense.side,
      playType: play,
      actorId: shooter.player.id,
      defenderId: defender.player.id,
      made: false,
      shotKind: isThree ? "3pt" : "2pt",
      contested,
      text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(shooter.player.name)} ${playVerb(play, isThree)}. Miss.${contestBit}`,
    });

    const rebounder = reboundBattle(offense, defense, rng);
    if (rebounder.team.side === offense.side) {
      rebounder.man.box.orb += 1;
      offense.box.orb += 1;
      extraPossession = offense.side;
      transition = false;
      push({
        period,
        clock,
        kind: "rebound",
        side: offense.side,
        actorId: rebounder.man.player.id,
        text: `${periodLabel(league, period)} ${formatClock(clock)} — Offensive rebound, ${lastName(rebounder.man.player.name)}.`,
      });
    } else {
      rebounder.man.box.drb += 1;
      defense.box.drb += 1;
      possession = defense.side;
      transition = chance(rng, 0.18);
      push({
        period,
        clock,
        kind: "rebound",
        side: defense.side,
        actorId: rebounder.man.player.id,
        text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(rebounder.man.player.name)} boards it.`,
      });
    }
  }

  homeScore = liveHome.box.score;
  awayScore = liveAway.box.score;
  const winner: Side | "tie" = homeScore === awayScore ? "tie" : homeScore > awayScore ? "home" : "away";
  push({
    period,
    clock: Math.max(0, clock),
    kind: "final",
    text: `Final — ${home.abbr} ${homeScore}, ${away.abbr} ${awayScore}.`,
  });

  return {
    league,
    seed,
    home,
    away,
    events,
    homeBox: liveHome.box,
    awayBox: liveAway.box,
    winner,
  };
}

function resolveMake(
  offense: LiveTeam,
  defense: LiveTeam,
  shooter: LivePlayer,
  initiator: LivePlayer,
  play: PlayType,
  isThree: boolean,
  contested: boolean,
  pts: number,
  period: number,
  clock: number,
  rules: LeagueRules,
  rng: () => number,
  push: (partial: Omit<GameEvent, "id">) => void,
  league: League,
) {
  shooter.box.fgm += 1;
  shooter.box.pts += pts;
  offense.box.fgm += 1;
  if (isThree) {
    shooter.box.fg3m += 1;
    offense.box.fg3m += 1;
  }
  addScore(offense, period, pts, rules);
  applyPlusMinus(offense, defense, pts);

  let assistId: string | undefined;
  const canAssist = play !== "isolation" && play !== "putback";
  const passers = onCourt(offense).filter((p) => p.player.id !== shooter.player.id);
  if (canAssist && passers.length && chance(rng, assistChance(initiator, play))) {
    const passer = weightedPick(
      rng,
      passers,
      (p) => p.player.ratings.pass * (p.player.id === initiator.player.id ? 1.8 : 0.7),
    );
    passer.box.ast += 1;
    offense.box.ast += 1;
    assistId = passer.player.id;
  }

  const contestBit = contested ? ` Contested.` : ` Open look.`;
  const helper = assistId ? liveById(offense, assistId) : undefined;
  const assistBit = helper ? ` Assist: ${lastName(helper.player.name)}.` : "";
  push({
    period,
    clock,
    kind: "shot",
    side: offense.side,
    playType: play,
    actorId: shooter.player.id,
    assistId,
    made: true,
    points: pts,
    shotKind: isThree ? "3pt" : "2pt",
    contested,
    text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(shooter.player.name)} ${playVerb(play, isThree)}. GOOD.${contestBit}${assistBit}`,
    homeScore: 0,
    awayScore: 0,
  });
}

function assistChance(initiator: LivePlayer, play: PlayType): number {
  let p = 0.42 + (initiator.player.ratings.pass - 50) * 0.008;
  if (play === "spot_up" || play === "cut" || play === "pnr_roll" || play === "pnr_pop") p += 0.18;
  if (play === "isolation") p = 0.08;
  return Math.max(0.12, Math.min(0.78, p));
}

function shootFts(
  offense: LiveTeam,
  defense: LiveTeam,
  shooter: LivePlayer,
  attempts: number,
  period: number,
  clock: number,
  rules: LeagueRules,
  rng: () => number,
  push: (partial: Omit<GameEvent, "id">) => void,
  league: League,
) {
  let lastMiss = false;
  for (let i = 1; i <= attempts; i++) {
    const made = chance(rng, ratingPct(shooter.player.ratings.freeThrow, 0.76, 0.93));
    shooter.box.fta += 1;
    offense.box.fta += 1;
    lastMiss = !made;
    if (made) {
      shooter.box.ftm += 1;
      offense.box.ftm += 1;
      shooter.box.pts += 1;
      addScore(offense, period, 1, rules);
      applyPlusMinus(offense, defense, 1);
    }
    push({
      period,
      clock,
      kind: "free_throw",
      side: offense.side,
      actorId: shooter.player.id,
      made,
      points: made ? 1 : 0,
      shotKind: "ft",
      text: `${periodLabel(league, period)} ${formatClock(clock)} — ${lastName(shooter.player.name)} ${made ? "makes" : "misses"} free throw ${i} of ${attempts}.`,
      homeScore: 0,
      awayScore: 0,
    });
  }
  void lastMiss;
}

function reboundBattle(
  offense: LiveTeam,
  defense: LiveTeam,
  rng: () => number,
): { team: LiveTeam; man: LivePlayer } {
  const oWeights = onCourt(offense).map((man) => ({
    team: offense,
    man,
    w: man.player.ratings.orb * (1.05 - man.fatigue * 0.2) * (primaryPosition(man.player.positions) === "C" ? 1.15 : 1),
  }));
  const dWeights = onCourt(defense).map((man) => ({
    team: defense,
    man,
    w:
      man.player.ratings.drb *
      1.85 *
      (1.05 - man.fatigue * 0.15) *
      (primaryPosition(man.player.positions) === "C" || primaryPosition(man.player.positions) === "PF" ? 1.1 : 1),
  }));
  return weightedPick(rng, [...oWeights, ...dWeights], (row) => row.w);
}

export function validateRoster(players: Player[]): string | null {
  if (players.length < 8) return "Need at least 8 players.";
  if (players.length > 12) return "Roster is capped at 12.";
  const groups = { G: 0, F: 0, C: 0 };
  for (const player of players) {
    groups[groupOf(primaryPosition(player.positions))] += 1;
  }
  if (groups.G < 2) return "Need at least two guards.";
  if (groups.F + groups.C < 3) return "Need more frontcourt depth (forwards or centers).";
  return null;
}

