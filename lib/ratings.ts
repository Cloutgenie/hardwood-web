import type {
  CareerStats,
  League,
  Player,
  PlayerSource,
  Position,
  RatingKey,
  Ratings,
} from "@/lib/types";

export const RATING_KEYS: RatingKey[] = [
  "finish",
  "midRange",
  "three",
  "freeThrow",
  "pass",
  "handle",
  "iq",
  "steal",
  "block",
  "perimeterD",
  "interiorD",
  "orb",
  "drb",
  "speed",
  "strength",
  "stamina",
  "vertical",
  "usage",
  "consistency",
  "durability",
];

type Baseline = { mean: number; sd: number };

type LeagueBaseline = {
  per36Pts: Baseline;
  per36Reb: Baseline;
  per36Ast: Baseline;
  per36Stl: Baseline;
  per36Blk: Baseline;
  per36Tov: Baseline;
  fgPct: Baseline;
  fg3Pct: Baseline;
  ftPct: Baseline;
  fg3Rate: Baseline;
  ftaRate: Baseline;
  mpg: Baseline;
};

/**
 * Rotation-player baselines, not league-wide including end-of-bench.
 * NBA and college are never mixed — a 27-point college season is not
 * an NBA 27-point season.
 */
const BASELINES: Record<League, LeagueBaseline> = {
  nba: {
    per36Pts: { mean: 16.2, sd: 5.8 },
    per36Reb: { mean: 6.4, sd: 3.1 },
    per36Ast: { mean: 3.6, sd: 2.4 },
    per36Stl: { mean: 1.15, sd: 0.45 },
    per36Blk: { mean: 0.7, sd: 0.75 },
    per36Tov: { mean: 2.2, sd: 0.85 },
    fgPct: { mean: 0.462, sd: 0.045 },
    fg3Pct: { mean: 0.348, sd: 0.045 },
    ftPct: { mean: 0.768, sd: 0.08 },
    fg3Rate: { mean: 0.3, sd: 0.18 },
    ftaRate: { mean: 0.28, sd: 0.12 },
    mpg: { mean: 28, sd: 7.5 },
  },
  college: {
    per36Pts: { mean: 15.4, sd: 5.2 },
    per36Reb: { mean: 6.6, sd: 3.0 },
    per36Ast: { mean: 3.1, sd: 2.2 },
    per36Stl: { mean: 1.25, sd: 0.55 },
    per36Blk: { mean: 0.85, sd: 0.9 },
    per36Tov: { mean: 2.4, sd: 0.9 },
    fgPct: { mean: 0.468, sd: 0.05 },
    fg3Pct: { mean: 0.352, sd: 0.05 },
    ftPct: { mean: 0.732, sd: 0.085 },
    fg3Rate: { mean: 0.32, sd: 0.2 },
    ftaRate: { mean: 0.34, sd: 0.14 },
    mpg: { mean: 29, sd: 6.5 },
  },
};

export function clampRating(value: number): number {
  return Math.max(20, Math.min(80, Math.round(value)));
}

/** Tiny samples regress hard; a full season starter is trusted. */
export function sampleReliability(league: League, games: number, mpg: number): number {
  const minutes = Math.max(0, games) * Math.max(0, mpg);
  const full = league === "nba" ? 7000 : 850;
  const floor = league === "nba" ? 250 : 100;
  if (minutes <= floor) return 0.18;
  return Math.min(1, 0.18 + (0.82 * (minutes - floor)) / (full - floor));
}

function regressRating(value: number, reliability: number, mean = 48): number {
  return clampRating(mean + (value - mean) * reliability);
}

/** Approximate FGA/36 from points and shooting rates. */
function fgaPer36(stats: CareerStats, pts36: number): number {
  const pointsPerFga =
    2 * Math.max(stats.fgPct, 0.3) * (1 + 0.5 * stats.fg3Rate) +
    stats.ftaRate * Math.max(stats.ftPct, 0.5);
  return pointsPerFga > 0.45 ? pts36 / pointsPerFga : pts36 / 1.1;
}

export function zToRating(value: number, baseline: Baseline, scale = 10): number {
  const z = (value - baseline.mean) / baseline.sd;
  return clampRating(50 + z * scale);
}

export function per36(stat: number, mpg: number): number {
  if (mpg <= 0) return 0;
  return (stat / mpg) * 36;
}

export function twoPointPct(stats: CareerStats): number {
  if (stats.fg3Pct == null || stats.fg3Rate <= 0.01) return stats.fgPct;
  const twoRate = 1 - stats.fg3Rate;
  if (twoRate <= 0.05) return stats.fgPct;
  const two = (stats.fgPct - stats.fg3Pct * stats.fg3Rate) / twoRate;
  return Math.max(0.28, Math.min(0.78, two));
}

export function primaryPosition(positions: Position[]): Position {
  return positions[0] ?? "SF";
}

function orbShare(pos: Position): number {
  switch (pos) {
    case "C":
      return 0.34;
    case "PF":
      return 0.3;
    case "SF":
      return 0.2;
    case "SG":
      return 0.15;
    case "PG":
      return 0.13;
  }
}

function emptyRatings(): Ratings {
  return {
    finish: 50,
    midRange: 50,
    three: 50,
    freeThrow: 50,
    pass: 50,
    handle: 50,
    iq: 50,
    steal: 50,
    block: 50,
    perimeterD: 50,
    interiorD: 50,
    orb: 50,
    drb: 50,
    speed: 50,
    strength: 50,
    stamina: 50,
    vertical: 50,
    usage: 50,
    consistency: 50,
    durability: 50,
    overall: 50,
  };
}

export function deriveRatings(source: PlayerSource): Ratings {
  const { stats, league, positions, heightIn, weightLb, boosts } = source;
  const base = BASELINES[league];
  const pos = primaryPosition(positions);
  const mpg = Math.max(stats.mpg, 8);
  const p36 = {
    pts: per36(stats.ppg, mpg),
    reb: per36(stats.rpg, mpg),
    ast: per36(stats.apg, mpg),
    stl: per36(stats.spg, mpg),
    blk: per36(stats.bpg, mpg),
    tov: per36(stats.topg, mpg),
  };
  const fg2 = twoPointPct(stats);
  const ratings = emptyRatings();

  ratings.usage = zToRating(stats.ppg + stats.apg * 0.65, {
    mean: league === "nba" ? 14.2 : 13.6,
    sd: league === "nba" ? 5.6 : 5.2,
  });

  const rimPressure = stats.ftaRate * 34 + (pos === "C" || pos === "PF" ? 4 : 3);
  const volumeFinish = Math.max(0, Math.min(8, (p36.pts - 18) * 0.7));
  ratings.finish = clampRating(
    zToRating(fg2, { mean: 0.49, sd: 0.055 }) * 0.42 +
      zToRating(stats.ftaRate, base.ftaRate) * 0.46 +
      rimPressure * 0.2 +
      (heightIn - 78) * 0.12 +
      volumeFinish,
  );

  ratings.midRange = clampRating(
    zToRating(fg2, { mean: 0.47, sd: 0.05 }) * 0.62 +
      (1 - Math.min(stats.fg3Rate, 0.55)) * 14 +
      (p36.pts > 22 ? 8 : p36.pts > 18 ? 4 : 0) +
      (pos === "PG" || pos === "SG" || pos === "SF" ? 3 : 0),
  );

  const threePa36 = fgaPer36(stats, p36.pts) * stats.fg3Rate;
  if (stats.fg3Pct == null || stats.fg3Rate < 0.04) {
    ratings.three = clampRating(24 + Math.min(threePa36, 4) * 4);
  } else {
    const pct = zToRating(stats.fg3Pct, base.fg3Pct, 10);
    const volume = Math.max(-6, Math.min(8, (threePa36 - 5) * 1.35));
    let three = pct + volume;
    if (threePa36 < 2.8) {
      three = 42 + (three - 42) * (threePa36 / 2.8);
    }
    ratings.three = clampRating(three);
  }

  ratings.freeThrow = zToRating(stats.ftPct, base.ftPct, 12);

  ratings.pass = zToRating(p36.ast, base.per36Ast, 11);
  const missingTovEra = stats.topg <= 0.05;
  if (missingTovEra) {
    ratings.handle = clampRating(50 + (ratings.pass - 50) * 0.28);
  } else {
    // Raw TOV/36 punishes high-usage creators. Grade turnovers against creation.
    const creationLoad = Math.max(8, p36.pts * 0.4 + p36.ast * 1.25);
    const tovRate = p36.tov / creationLoad;
    ratings.handle = Math.max(
      30,
      clampRating(
        zToRating(-tovRate, { mean: -0.2, sd: 0.055 }, 10) + (ratings.pass - 50) * 0.18,
      ),
    );
  }
  const astTo = stats.topg > 0.2 ? stats.apg / stats.topg : stats.apg * 2;
  ratings.iq = clampRating(
    zToRating(astTo, { mean: 1.7, sd: 0.85 }, 9) * 0.4 +
      ratings.pass * 0.28 +
      ratings.handle * 0.14 +
      (50 + (mpg - 28) * 0.65) * 0.18,
  );

  ratings.steal = zToRating(p36.stl, base.per36Stl, 11);
  ratings.block = zToRating(p36.blk, base.per36Blk, 11);

  const perimeterBias = pos === "PG" || pos === "SG" || pos === "SF" ? 6 : -4;
  const interiorBias = pos === "C" || pos === "PF" ? 7 : -5;
  ratings.perimeterD = clampRating(
    ratings.steal * 0.55 + ratings.iq * 0.2 + 25 + perimeterBias + (80 - heightIn) * 0.15,
  );
  ratings.interiorD = clampRating(
    ratings.block * 0.55 + (heightIn - 78) * 1.1 + 28 + interiorBias + (weightLb - 220) * 0.04,
  );

  const orbPg = stats.rpg * orbShare(pos);
  const drbPg = stats.rpg - orbPg;
  ratings.orb = zToRating(per36(orbPg, mpg), { mean: 1.8, sd: 1.2 }, 11);
  ratings.drb = zToRating(per36(drbPg, mpg), { mean: 4.6, sd: 2.2 }, 11);

  const guardSpeed = pos === "PG" || pos === "SG" ? 6 : pos === "SF" ? 2 : -4;
  ratings.speed = clampRating(
    48 +
      guardSpeed +
      (ratings.steal - 50) * 0.35 +
      (78 - heightIn) * 0.45 +
      (220 - weightLb) * 0.03,
  );
  ratings.strength = clampRating(
    46 +
      (weightLb - 210) * 0.08 +
      (ratings.orb - 50) * 0.25 +
      (pos === "C" || pos === "PF" ? 6 : 0) +
      stats.ftaRate * 18,
  );
  ratings.vertical = clampRating(
    47 + (ratings.block - 50) * 0.35 + ratings.speed * 0.15 + (pos === "C" || pos === "PF" || pos === "SF" ? 3 : 0),
  );
  ratings.stamina = zToRating(mpg, base.mpg, 9);
  ratings.durability = clampRating(
    42 + Math.min(28, stats.games / 40) + (mpg > 20 ? 4 : 0),
  );
  ratings.consistency = clampRating(
    44 + Math.min(20, stats.games / 50) + (ratings.iq - 50) * 0.2,
  );

  const reliability = sampleReliability(league, stats.games, mpg);
  if (reliability < 0.99) {
    const volatile: RatingKey[] = [
      "finish",
      "midRange",
      "three",
      "pass",
      "handle",
      "iq",
      "steal",
      "block",
      "perimeterD",
      "interiorD",
      "orb",
      "drb",
      "usage",
    ];
    for (const key of volatile) {
      ratings[key] = regressRating(ratings[key], reliability);
    }
  }

  if (boosts) {
    for (const key of RATING_KEYS) {
      const boost = boosts[key];
      if (boost != null) {
        ratings[key] = clampRating(ratings[key] * 0.35 + boost * 0.65);
      }
    }
  }

  ratings.overall = overallFromRatings(ratings, pos);
  return ratings;
}

export function overallFromRatings(ratings: Ratings, pos: Position): number {
  const blend = ratings.finish * 0.36 + ratings.midRange * 0.28 + ratings.three * 0.36;
  const peakShot = Math.max(ratings.finish, ratings.midRange, ratings.three);
  const scoring = peakShot * 0.4 + blend * 0.6;
  const stop =
    ratings.perimeterD * 0.32 +
    ratings.interiorD * 0.32 +
    ratings.block * 0.18 +
    ratings.steal * 0.18;
  const glass = ratings.orb * 0.4 + ratings.drb * 0.6;
  const family = pos === "PG" || pos === "SG" ? "G" : pos === "C" ? "C" : "F";

  let weighted: number;
  if (family === "G") {
    weighted =
      scoring * 0.26 +
      ratings.usage * 0.22 +
      ratings.pass * 0.08 +
      stop * 0.12 +
      ratings.handle * 0.07 +
      ratings.iq * 0.07 +
      ratings.speed * 0.06 +
      ratings.stamina * 0.07 +
      glass * 0.05;
  } else if (family === "C") {
    weighted =
      ratings.usage * 0.2 +
      ratings.finish * 0.16 +
      ratings.interiorD * 0.14 +
      glass * 0.14 +
      ratings.pass * 0.1 +
      ratings.block * 0.08 +
      ratings.strength * 0.08 +
      ratings.iq * 0.06 +
      scoring * 0.04;
  } else {
    weighted =
      scoring * 0.24 +
      ratings.usage * 0.2 +
      stop * 0.14 +
      glass * 0.1 +
      ratings.pass * 0.08 +
      ratings.iq * 0.08 +
      ratings.strength * 0.08 +
      ratings.stamina * 0.08;
  }

  if (ratings.usage < 62) {
    const damp = 0.42 + (0.58 * (ratings.usage - 34)) / 28;
    weighted = 50 + (weighted - 50) * Math.max(0.48, Math.min(1, damp));
  }

  const create = ratings.pass * 0.4 + ratings.usage * 0.6;
  const breadth = [scoring, create, ratings.iq].filter((n) => n >= 64).length;
  return clampRating(50 + (weighted - 50) * 1.72 + breadth * 0.8);
}

export function hydratePlayer(source: PlayerSource): Player {
  return { ...source, ratings: deriveRatings(source) };
}

export function ratingColor(value: number): string {
  if (value >= 75) return "text-amber-200";
  if (value >= 65) return "text-emerald-300";
  if (value >= 55) return "text-sky-300";
  if (value >= 45) return "text-zinc-300";
  if (value >= 35) return "text-orange-300";
  return "text-rose-400";
}

export function ratingLabel(value: number): string {
  if (value >= 75) return "Elite";
  if (value >= 65) return "Plus";
  if (value >= 55) return "Solid";
  if (value >= 45) return "Avg";
  if (value >= 35) return "Below";
  return "Poor";
}

export const RATING_GROUPS: { title: string; keys: { key: RatingKey; label: string }[] }[] = [
  {
    title: "Scoring",
    keys: [
      { key: "finish", label: "Finish" },
      { key: "midRange", label: "Mid" },
      { key: "three", label: "Three" },
      { key: "freeThrow", label: "FT" },
      { key: "usage", label: "Usage" },
    ],
  },
  {
    title: "Creation",
    keys: [
      { key: "pass", label: "Pass" },
      { key: "handle", label: "Handle" },
      { key: "iq", label: "IQ" },
    ],
  },
  {
    title: "Defense",
    keys: [
      { key: "perimeterD", label: "Perim D" },
      { key: "interiorD", label: "Int D" },
      { key: "steal", label: "Steal" },
      { key: "block", label: "Block" },
    ],
  },
  {
    title: "Glass / Body",
    keys: [
      { key: "orb", label: "ORB" },
      { key: "drb", label: "DRB" },
      { key: "speed", label: "Speed" },
      { key: "strength", label: "Strength" },
      { key: "stamina", label: "Stamina" },
    ],
  },
];
