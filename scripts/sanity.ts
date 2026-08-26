import { CATALOG, buildTeam } from "@/lib/data/catalog";
import { PRESETS } from "@/lib/data/presets";
import { getPlayer } from "@/lib/data/catalog";
import { filterPlayers } from "@/lib/data/search";
import { assembleTeam } from "@/lib/teams";
import { simulateGame } from "@/lib/sim/engine";
import { boxesThrough, projectLive } from "@/lib/sim/live-box";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const nba = CATALOG.nba;
const college = CATALOG.college;
assert(nba.length >= 4000, `Expected every NBA player, got ${nba.length}`);
assert(college.length >= 20000, `Expected a full D1 college pool, got ${college.length}`);

const ids = [...nba, ...college].map((p) => p.id);
assert(new Set(ids).size === ids.length, "Duplicate player ids");

const curryNba = getPlayer("nba-curry")!;
const shaq = getPlayer("nba-shaq")!;
const jokic = getPlayer("nba-jokic")!;
const gobert = getPlayer("nba-gobert")!;
const hurleyCbb = getPlayer("cbb-hurley")!;
assert(hurleyCbb.school === "Duke", `Duke Bobby Hurley should not be the Arizona State namesake: ${hurleyCbb.school}`);
const bookerCbb = getPlayer("cbb-booker")!;
assert(bookerCbb.school === "Kentucky", `Kentucky Devin Booker should not be the George Mason namesake: ${bookerCbb.school}`);

const curryCbb = getPlayer("cbb-curry")!;
const zionCbb = getPlayer("cbb-zion")!;
const zionNba = getPlayer("nba-zion")!;

assert(curryNba.ratings.three > shaq.ratings.three + 20, "Curry should dwarf Shaq from three");
assert(jokic.ratings.pass > gobert.ratings.pass + 10, "Jokić should out-pass Gobert");
assert(shaq.ratings.finish > curryNba.ratings.finish, "Shaq should finish better than Curry");
assert(zionCbb.ratings.finish >= 65, "College Zion should be an elite finisher");
assert(curryCbb.league === "college" && curryNba.league === "nba", "Contexts must stay split");
assert(zionCbb.stats.ppg !== zionNba.stats.ppg, "Zion college and NBA lines should differ");

for (const preset of PRESETS) {
  const missing = preset.playerIds.filter((id) => !getPlayer(id));
  assert(missing.length === 0, `${preset.name} missing ${missing.join(", ")}`);
}

const schoolMustMatch: Record<string, string> = {
  "1992 Duke": "Duke",
  "2012 Kentucky": "Kentucky",
  "2008 UCLA": "UCLA",
  "2019 Virginia": "Virginia",
  "2008 Kansas": "Kansas",
  "1991 UNLV": "UNLV",
};
for (const [name, school] of Object.entries(schoolMustMatch)) {
  const preset = PRESETS.find((p) => p.name === name)!;
  const wrong = preset.playerIds
    .map((id) => getPlayer(id)!)
    .filter((p) => !(p.school ?? "").includes(school));
  assert(
    wrong.length === 0,
    `${name} has players who were not ${school}: ${wrong.map((p) => `${p.name} (${p.school})`).join(", ")}`,
  );
}

const mustInclude: Record<string, string[]> = {
  "1992 Duke": ["Christian Laettner", "Bobby Hurley", "Grant Hill", "Thomas Hill"],
  "2012 Kentucky": ["Anthony Davis", "Michael Kidd-Gilchrist", "Doron Lamb", "Marquis Teague"],
  "2008 UCLA": ["Russell Westbrook", "Kevin Love", "Darren Collison"],
  "2019 Virginia": ["Kyle Guy", "Ty Jerome", "De'Andre Hunter", "Mamadi Diakite"],
  "2008 Kansas": ["Mario Chalmers", "Brandon Rush", "Darrell Arthur"],
  "1991 UNLV": ["Larry Johnson", "Stacey Augmon", "Anderson Hunt", "Greg Anthony"],
};
for (const [name, needed] of Object.entries(mustInclude)) {
  const have = new Set(PRESETS.find((p) => p.name === name)!.playerIds.map((id) => getPlayer(id)!.name));
  const missing = needed.filter((n) => !have.has(n));
  assert(missing.length === 0, `${name} is missing ${missing.join(", ")}`);
}

assert(!PRESETS.some((p) => p.name === "UCLA Giants"), "Year presets should not keep the UCLA Giants mashup");
const mashupNames = ["J.J. Redick", "Karl-Anthony Towns", "Jahlil Okafor", "Carmelo Anthony", "Chris Webber", "Zach Edey"];
for (const name of ["1992 Duke", "2012 Kentucky", "2008 UCLA", "2019 Virginia", "2008 Kansas", "1991 UNLV"]) {
  const have = PRESETS.find((p) => p.name === name)!.playerIds.map((id) => getPlayer(id)!.name);
  const leaked = have.filter((n) => mashupNames.includes(n));
  assert(leaked.length === 0, `${name} still has mashup names: ${leaked.join(", ")}`);
}

const bullsPreset = PRESETS.find((p) => p.name === "1996 Bulls")!;
const aliasKnown = bullsPreset.playerIds.map((id) => getPlayer(id)!);
const aliasAssembled = assembleTeam(bullsPreset, aliasKnown);
assert(aliasAssembled.players.length === 8, `Client assemble should resolve preset aliases, got ${aliasAssembled.players.length}`);
const warriorsAssembled = assembleTeam(
  PRESETS.find((p) => p.name === "2017 Warriors")!,
  PRESETS.find((p) => p.name === "2017 Warriors")!.playerIds.map((id) => getPlayer(id)!),
);
assert(warriorsAssembled.players.length === 8, "Warriors aliases should resolve");
simulateGame(aliasAssembled, warriorsAssembled, 7);

const bulls = buildTeam(bullsPreset);
const modern = buildTeam(PRESETS.find((p) => p.name === "Modern Superteam")!);
const duke = buildTeam(PRESETS.find((p) => p.name === "1992 Duke")!);
const uva = buildTeam(PRESETS.find((p) => p.name === "2019 Virginia")!);

const nbaGame = simulateGame(bulls, modern, 42);
assert(nbaGame.events.length > 120, "NBA game should produce a long play-by-play");
assert(nbaGame.homeBox.score + nbaGame.awayBox.score > 140, "NBA combined score should be in modern range");
assert(nbaGame.homeBox.periodScores.length >= 4, "NBA should play at least four periods");

const cbbGame = simulateGame(duke, uva, 99);
assert(cbbGame.events.length > 80, "College game should still be possession-level");
assert(cbbGame.homeBox.score + cbbGame.awayBox.score < nbaGame.homeBox.score + nbaGame.awayBox.score, "College totals should usually sit under NBA totals");

const jasonTatum = filterPlayers(nba, "Jason Tatum", 8);
assert(
  jasonTatum.players[0]?.id === "nba-tatumja01",
  `Jason Tatum should resolve to Jayson Tatum, got ${jasonTatum.players[0]?.name ?? "nobody"}`,
);
assert(
  filterPlayers(nba, "tatum", 8).players.some((p) => p.id === "nba-tatumja01"),
  "Last-name search should find Tatum",
);
assert(
  filterPlayers(nba, "doncic", 8).players[0]?.name.includes("Don"),
  "Accent-folded search should find Dončić",
);

const tipOnly = projectLive(nbaGame, 0);
assert(!tipOnly.finished, "Tip-off should not be final");
assert(tipOnly.homeBox.fga === 0 && tipOnly.awayBox.fga === 0, "Snapshot must start 0-0, not the final line");
assert(tipOnly.events[tipOnly.events.length - 1]?.kind !== "final", "Last play at tip cannot be Final");
const mid = projectLive(nbaGame, Math.min(40, nbaGame.events.length - 2));
assert(!mid.finished, "Mid-game replay should still be live");
assert(
  mid.homeBox.fga + mid.awayBox.fga < nbaGame.homeBox.fga + nbaGame.awayBox.fga,
  "Live shooting line should trail the final box until the last play",
);
const done = projectLive(nbaGame, nbaGame.events.length - 1);
assert(done.finished, "Last event should mark the game final");
assert(done.homeBox.score === nbaGame.homeBox.score, "Final snapshot home score should match the official box");
const rebuilt = boxesThrough(nbaGame, nbaGame.events);
assert(rebuilt.homeBox.fgm === nbaGame.homeBox.fgm, "Rebuilt home FGM should match the engine box");
assert(rebuilt.awayBox.ast === nbaGame.awayBox.ast, "Rebuilt away assists should match the engine box");

assert(curryNba.ratings.overall >= 70, `NBA Curry overall too low: ${curryNba.ratings.overall}`);
assert(jokic.ratings.overall >= 70, `Jokić overall too low: ${jokic.ratings.overall}`);

const lebron = getPlayer("nba-lebron")!;
const jordan = getPlayer("nba-jordan")!;
const luka = getPlayer("nba-luka")!;
const magic = getPlayer("nba-magic")!;
const camSpencer = getPlayer("nba-spencca01")!;
const hali = getPlayer("nba-halibty01")!;
assert(lebron.ratings.handle >= 54, `LeBron handle should not be crushed by usage TOV: ${lebron.ratings.handle}`);
assert(luka.ratings.handle >= 52, `Luka handle should not be crushed by usage TOV: ${luka.ratings.handle}`);
assert(magic.ratings.handle >= 54, `Magic handle should not be crushed by usage TOV: ${magic.ratings.handle}`);
assert(lebron.ratings.overall >= 70, `LeBron overall too low: ${lebron.ratings.overall}`);
assert(jordan.ratings.overall >= 70, `Jordan overall too low: ${jordan.ratings.overall}`);
assert(camSpencer.ratings.overall <= 60, `Cam Spencer overall too high for a bench specialist: ${camSpencer.ratings.overall}`);
assert(
  camSpencer.ratings.overall <= lebron.ratings.overall - 10,
  `Cam Spencer (${camSpencer.ratings.overall}) should sit well below LeBron (${lebron.ratings.overall})`,
);
assert(
  hali.ratings.overall <= curryNba.ratings.overall + 2,
  `Haliburton (${hali.ratings.overall}) should not outrank Curry (${curryNba.ratings.overall}) by more than a hair`,
);
assert(zionCbb.ratings.overall >= 68, `College Zion overall too low: ${zionCbb.ratings.overall}`);
const tinyCollege = college.filter((p) => p.stats.games < 12 && p.ratings.overall >= 65);
assert(tinyCollege.length === 0, `Tiny college samples should not be 65+ OVR: ${tinyCollege.map((p) => `${p.name} ${p.ratings.overall}`).join(", ")}`);
console.log("NBA pool", nba.length, "top", nba[0]?.name, nba[0]?.ratings.overall);
console.log("College pool", college.length, "top", college[0]?.name, college[0]?.ratings.overall);
console.log(
  `Bulls ${nbaGame.homeBox.score} - ${nbaGame.awayBox.score} NOW · ${nbaGame.events.length} events`,
);
console.log(
  `Duke ${cbbGame.homeBox.score} - ${cbbGame.awayBox.score} UVA · ${cbbGame.events.length} events`,
);
console.log("sanity ok");
