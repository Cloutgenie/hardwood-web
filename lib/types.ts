export type League = "nba" | "college";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type Side = "home" | "away";

export type PlayType =
  | "transition"
  | "isolation"
  | "pnr_handler"
  | "pnr_roll"
  | "pnr_pop"
  | "post"
  | "spot_up"
  | "cut"
  | "putback"
  | "oreb_kick";

export type EventKind =
  | "tip"
  | "shot"
  | "free_throw"
  | "rebound"
  | "turnover"
  | "foul"
  | "sub"
  | "period"
  | "timeout"
  | "final";

export interface CareerStats {
  games: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fgPct: number;
  fg3Pct: number | null;
  ftPct: number;
  /** 3PA / FGA. 0 for pre-three eras or non-shooters. */
  fg3Rate: number;
  /** FTA / FGA. Proxy for rim pressure and physicality. */
  ftaRate: number;
}

export interface Ratings {
  finish: number;
  midRange: number;
  three: number;
  freeThrow: number;
  pass: number;
  handle: number;
  iq: number;
  steal: number;
  block: number;
  perimeterD: number;
  interiorD: number;
  orb: number;
  drb: number;
  speed: number;
  strength: number;
  stamina: number;
  vertical: number;
  usage: number;
  consistency: number;
  durability: number;
  overall: number;
}

export type RatingKey = Exclude<keyof Ratings, "overall">;

export interface PlayerSource {
  id: string;
  name: string;
  league: League;
  years: string;
  school?: string;
  nbaTeams?: string;
  heightIn: number;
  weightLb: number;
  positions: Position[];
  stats: CareerStats;
  /** Applied after the stat-derived card. Use for pre-stat-era defense, etc. */
  boosts?: Partial<Ratings>;
  note?: string;
}

export interface Player extends PlayerSource {
  ratings: Ratings;
}

export interface Team {
  name: string;
  abbr: string;
  league: League;
  playerIds: string[];
}

export interface BuiltTeam extends Team {
  players: Player[];
  starters: string[];
}

export interface LeagueRules {
  league: League;
  periods: number;
  periodMinutes: number;
  otMinutes: number;
  shotClock: number;
  bonusFouls: number;
  doubleBonusFouls?: number;
  dqFouls: number;
  oneAndOne: boolean;
  targetPace: number;
}

export interface PlayerBox {
  playerId: string;
  minutes: number;
  pts: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  plusMinus: number;
}

export interface TeamBox {
  score: number;
  periodScores: number[];
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  players: Record<string, PlayerBox>;
}

export interface GameEvent {
  id: number;
  period: number;
  clock: number;
  kind: EventKind;
  side?: Side;
  playType?: PlayType;
  actorId?: string;
  assistId?: string;
  defenderId?: string;
  stealId?: string;
  blockId?: string;
  made?: boolean;
  points?: number;
  shotKind?: "2pt" | "3pt" | "ft";
  contested?: boolean;
  text: string;
  homeScore: number;
  awayScore: number;
}

export interface GameResult {
  league: League;
  seed: number;
  home: BuiltTeam;
  away: BuiltTeam;
  events: GameEvent[];
  homeBox: TeamBox;
  awayBox: TeamBox;
  winner: Side | "tie";
}

export interface MatchupPayload {
  league: League;
  seed?: number;
  home: Team;
  away: Team;
}
