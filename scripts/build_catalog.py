#!/usr/bin/env python3
"""Build NBA + college career catalogs from public season dumps."""

from __future__ import annotations

import csv
import json
import os
import re
import time
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path("/tmp/bball-raw")
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

NBA_TOTALS = RAW / "player-totals.csv"
NBA_INFO = RAW / "player-career-info.csv"
BART_DIR = RAW / "barttorvik"
BART_DIR.mkdir(parents=True, exist_ok=True)

PRO_LEAGUES = {"NBA", "BAA"}
NBA_TOTALS_URL = (
    "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/"
    "master/Data/Player%20Totals.csv"
)
NBA_INFO_URL = (
    "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/"
    "master/Data/Player%20Career%20Info.csv"
)


def norm_name(name: str) -> str:
    decomposed = unicodedata.normalize("NFD", name or "")
    return "".join(ch for ch in decomposed.lower() if ch.isalpha())


def school_tokens(text: str) -> set[str]:
    value = (text or "").lower().replace("st.", "state").replace("&", " and ")
    value = value.replace("uconn", "connecticut").replace("unc", "north carolina")
    tokens = set(re.findall(r"[a-z0-9]+", value))
    tokens.difference_update({"the", "of", "and", "univ", "university", "college", "st"})
    if "st" in (text or "").lower().split() or "st." in (text or "").lower():
        tokens.add("state")
    return tokens


def same_college_player(legacy: dict, name: str, schools: list[str]) -> bool:
    if norm_name(legacy.get("name", "")) != norm_name(name):
        return False
    legacy_schools = school_tokens(str(legacy.get("school", "")))
    modern_schools = school_tokens(" ".join(schools))
    return bool(legacy_schools & modern_schools)


def num(value: object, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_height(text: str, fallback: int = 78) -> int:
    if not text:
        return fallback
    if text.isdigit():
        return int(text)
    match = re.match(r"(\d+)-(\d+)", text)
    if match:
        return int(match.group(1)) * 12 + int(match.group(2))
    return fallback


def map_pos(raw: str, ast: float = 0, reb: float = 0, height: int = 78) -> list[str]:
    token = (raw or "").upper().replace("-", "/")
    mapping = {
        "PG": ["PG"],
        "SG": ["SG"],
        "SF": ["SF"],
        "PF": ["PF"],
        "C": ["C"],
        "G": ["SG", "PG"] if ast < 4 else ["PG", "SG"],
        "F": ["SF", "PF"],
        "G/F": ["SG", "SF"],
        "F/G": ["SF", "SG"],
        "F/C": ["PF", "C"],
        "C/F": ["C", "PF"],
    }
    if token in mapping:
        return mapping[token]
    role = (raw or "").lower()
    if "pure pg" in role or "scoring pg" in role:
        return ["PG"]
    if "combo" in role:
        return ["PG", "SG"]
    if "wing g" in role or "shoot" in role:
        return ["SG"]
    if "stretch" in role:
        return ["PF", "SF"]
    if "wing f" in role:
        return ["SF"]
    if "pf/c" in role or role.strip() in {"c", "center"}:
        return ["C", "PF"] if height < 83 else ["C"]
    if "pf" in role:
        return ["PF"]
    if height <= 74 and ast >= 3:
        return ["PG"]
    if height <= 77:
        return ["SG"]
    if height <= 80:
        return ["SF"]
    if height <= 83:
        return ["PF"]
    return ["C"]


def extract_legacy() -> tuple[dict[str, dict], dict[str, dict]]:
    """Read hand-built cards for aliases, boosts, and pre-2008 college legends."""
    nba: dict[str, dict] = {}
    college: dict[str, dict] = {}
    card_re = re.compile(
        r'card\("([^"]+)",\s*"([^"]+)",\s*"(nba|college)",\s*"([^"]+)",\s*\[([^\]]*)\],\s*(\d+),\s*(\d+),\s*line\(([^)]+)\)(?:,\s*\{([^}]*)\})?',
        re.S,
    )
    for path, bucket in ((ROOT / "lib/data/nba.ts", nba), (ROOT / "lib/data/college.ts", college)):
        text = path.read_text()
        for match in card_re.finditer(text):
            player_id, name, league, years, pos_raw, height, weight, line_raw, extra = match.groups()
            extras = extra or ""
            boosts_match = re.search(r"boosts:\s*(\{[^}]*\})", extras)
            boosts = None
            if boosts_match:
                try:
                    boosts = json.loads(re.sub(r"(\w+):", r'"\1":', boosts_match.group(1)))
                except json.JSONDecodeError:
                    boosts = None
            school = re.search(r'school:\s*"([^"]+)"', extras)
            note = re.search(r'note:\s*"([^"]+)"', extras)
            parts = [p.strip() for p in line_raw.split(",")]
            stats = {
                "games": int(float(parts[0])),
                "mpg": float(parts[1]),
                "ppg": float(parts[2]),
                "rpg": float(parts[3]),
                "apg": float(parts[4]),
                "spg": float(parts[5]),
                "bpg": float(parts[6]),
                "topg": float(parts[7]),
                "fgPct": float(parts[8]),
                "fg3Pct": None if parts[9] == "null" else float(parts[9]),
                "ftPct": float(parts[10]),
                "fg3Rate": float(parts[11]),
                "ftaRate": float(parts[12]),
            }
            positions = [p.strip().strip('"') for p in pos_raw.split(",") if p.strip()]
            bucket[norm_name(name)] = {
                "id": player_id,
                "name": name,
                "league": league,
                "years": years,
                "heightIn": int(height),
                "weightLb": int(weight),
                "positions": positions,
                "stats": stats,
                "school": school.group(1) if school else None,
                "boosts": boosts,
                "note": note.group(1) if note else None,
            }
    return nba, college


def build_nba(legacy: dict[str, dict]) -> list[dict]:
    info: dict[str, dict] = {}
    with NBA_INFO.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            info[row["player_id"]] = row

    seasons: dict[tuple[str, str], dict] = {}
    with NBA_TOTALS.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["lg"] not in PRO_LEAGUES:
                continue
            if num(row["g"]) <= 0:
                continue
            key = (row["player_id"], row["season"])
            existing = seasons.get(key)
            if row["team"] == "TOT":
                seasons[key] = row
            elif existing is None or existing.get("team") != "TOT":
                seasons[key] = row

    totals: dict[str, dict] = {}
    pos_votes: dict[str, Counter] = defaultdict(Counter)
    team_votes: dict[str, Counter] = defaultdict(Counter)
    for row in seasons.values():
        pid = row["player_id"]
        bucket = totals.setdefault(
            pid,
            {
                "g": 0,
                "mp": 0.0,
                "pts": 0.0,
                "trb": 0.0,
                "ast": 0.0,
                "stl": 0.0,
                "blk": 0.0,
                "tov": 0.0,
                "fg": 0.0,
                "fga": 0.0,
                "x3p": 0.0,
                "x3pa": 0.0,
                "ft": 0.0,
                "fta": 0.0,
            },
        )
        for key in bucket:
            bucket[key] += num(row.get(key if key != "g" else "g"))
        pos_votes[pid][row.get("pos") or ""] += int(num(row["g"]))
        if row.get("team") and row["team"] != "TOT":
            team_votes[pid][row["team"]] += int(num(row["g"]))

    players = []
    for pid, tot in totals.items():
        games = tot["g"]
        if games < 1:
            continue
        bio = info.get(pid, {})
        name = bio.get("player") or pid
        mpg = tot["mp"] / games if tot["mp"] else 0
        fga = tot["fga"]
        x3pa = tot["x3pa"]
        stats = {
            "games": int(games),
            "mpg": round(mpg, 1),
            "ppg": round(tot["pts"] / games, 1),
            "rpg": round(tot["trb"] / games, 1),
            "apg": round(tot["ast"] / games, 1),
            "spg": round(tot["stl"] / games, 1),
            "bpg": round(tot["blk"] / games, 1),
            "topg": round(tot["tov"] / games, 1),
            "fgPct": round(tot["fg"] / fga, 3) if fga else 0,
            "fg3Pct": round(tot["x3p"] / x3pa, 3) if x3pa >= 10 else None,
            "ftPct": round(tot["ft"] / tot["fta"], 3) if tot["fta"] else 0,
            "fg3Rate": round(x3pa / fga, 3) if fga else 0,
            "ftaRate": round(tot["fta"] / fga, 3) if fga else 0,
        }
        height = int(num(bio.get("ht_in_in"), 78))
        weight = int(num(bio.get("wt"), 210))
        pos_raw = pos_votes[pid].most_common(1)[0][0] if pos_votes[pid] else bio.get("pos", "")
        positions = map_pos(pos_raw, stats["apg"], stats["rpg"], height)
        teams = [tm for tm, _ in team_votes[pid].most_common(6)]
        fr, to = bio.get("from") or "", bio.get("to") or ""
        years = f"{fr}–{to}" if fr and to else ""
        prior = legacy.get(norm_name(name))
        aliases = [prior["id"]] if prior and prior["id"].startswith("nba-") else []
        players.append(
            {
                "id": f"nba-{pid}",
                "name": name,
                "league": "nba",
                "years": years,
                "heightIn": height or 78,
                "weightLb": weight or 210,
                "positions": positions,
                "stats": stats,
                "nbaTeams": " / ".join(teams) if teams else None,
                "school": bio.get("colleges") or None,
                "boosts": prior.get("boosts") if prior else None,
                "note": prior.get("note") if prior else None,
                "aliases": aliases,
            }
        )
    players.sort(key=lambda p: (-p["stats"]["ppg"], p["name"]))
    return players


def fetch_url(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        return
    print(f"fetch {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as response:
        dest.write_bytes(response.read())


def fetch_nba_csvs() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    fetch_url(NBA_TOTALS_URL, NBA_TOTALS)
    fetch_url(NBA_INFO_URL, NBA_INFO)


def fetch_bart(year: int) -> list:
    path = BART_DIR / f"{year}.json"
    if path.exists():
        return json.loads(path.read_text())
    url = f"https://barttorvik.com/getadvstats.php?year={year}"
    print(f"fetch {url}")
    with urllib.request.urlopen(url, timeout=60) as response:
        data = json.loads(response.read())
    years = {row[31] for row in data}
    if year not in years:
        raise RuntimeError(f"Barttorvik {year} returned {years}")
    path.write_text(json.dumps(data))
    time.sleep(0.25)
    return data


def build_college(legacy: dict[str, dict]) -> list[dict]:
    seasons: dict[str, list] = defaultdict(list)
    meta: dict[str, dict] = {}
    for year in range(2008, 2027):
        for row in fetch_bart(year):
            if row[31] != year:
                continue
            pid = str(row[32])
            gp = num(row[3])
            if gp < 1:
                continue
            seasons[pid].append(row)
            meta[pid] = {
                "name": row[0],
                "school": row[1],
                "height": parse_height(str(row[26] or ""), 78),
                "role": row[64] or "",
                "year": year,
            }

    players = []
    seen_names = set()
    for pid, rows in seasons.items():
        games = sum(num(r[3]) for r in rows)
        if games < 1:
            continue

        def wavg(index: int) -> float:
            return sum(num(r[index]) * num(r[3]) for r in rows) / games

        ftm = sum(num(r[13]) for r in rows)
        fta = sum(num(r[14]) for r in rows)
        tpm = sum(num(r[16]) for r in rows)
        tpa = sum(num(r[17]) for r in rows)
        thm = sum(num(r[19]) for r in rows)
        tha = sum(num(r[20]) for r in rows)
        fgm = tpm + thm
        fga = tpa + tha
        mpg = wavg(4) / 100 * 40
        topg = (wavg(12) / 100) * (wavg(6) / 100) * 70 * (wavg(4) / 100)
        schools = []
        for row in rows:
            if row[1] not in schools:
                schools.append(row[1])
        years = f"{min(int(r[31]) for r in rows)}–{max(int(r[31]) for r in rows)}"
        info = meta[pid]
        height = info["height"]
        stats = {
            "games": int(games),
            "mpg": round(mpg, 1),
            "ppg": round(wavg(63), 1),
            "rpg": round(wavg(59), 1),
            "apg": round(wavg(60), 1),
            "spg": round(wavg(61), 1),
            "bpg": round(wavg(62), 1),
            "topg": round(topg, 1),
            "fgPct": round(fgm / fga, 3) if fga else 0,
            "fg3Pct": round(thm / tha, 3) if tha >= 8 else None,
            "ftPct": round(ftm / fta, 3) if fta else 0,
            "fg3Rate": round(tha / fga, 3) if fga else 0,
            "ftaRate": round(fta / fga, 3) if fga else 0,
        }
        name = info["name"]
        legacy_card = legacy.get(norm_name(name))
        matched = bool(legacy_card and same_college_player(legacy_card, name, schools))
        aliases = [legacy_card["id"]] if matched and legacy_card["id"].startswith("cbb-") else []
        players.append(
            {
                "id": f"cbb-{pid}",
                "name": name,
                "league": "college",
                "years": years,
                "heightIn": height,
                "weightLb": legacy_card["weightLb"] if matched and legacy_card else 210,
                "positions": map_pos(info["role"], stats["apg"], stats["rpg"], height),
                "stats": stats,
                "school": " / ".join(schools[:3]),
                "boosts": legacy_card.get("boosts") if matched and legacy_card else None,
                "note": None,
                "aliases": aliases,
            }
        )
        if matched:
            seen_names.add(norm_name(name))

    for key, card in legacy.items():
        if key in seen_names:
            continue
        players.append(
            {
                **{k: card[k] for k in ("id", "name", "league", "years", "heightIn", "weightLb", "positions", "stats", "school", "boosts", "note")},
                "aliases": [],
            }
        )
    players.sort(key=lambda p: (-p["stats"]["ppg"], p["name"]))
    return players


def strip_nulls(players: list[dict]) -> list[dict]:
    cleaned = []
    for player in players:
        row = {k: v for k, v in player.items() if v not in (None, [], {})}
        cleaned.append(row)
    return cleaned


def catalog_present() -> bool:
    return all((OUT / name).exists() and (OUT / name).stat().st_size > 0 for name in ("nba.json", "college.json", "aliases.json"))


def main() -> None:
    if catalog_present() and os.environ.get("FORCE_CATALOG") != "1":
        print("catalog already present; set FORCE_CATALOG=1 to rebuild")
        return
    fetch_nba_csvs()
    nba_legacy, college_legacy = extract_legacy()
    print(f"legacy nba {len(nba_legacy)} college {len(college_legacy)}")
    nba = strip_nulls(build_nba(nba_legacy))
    college = strip_nulls(build_college(college_legacy))
    aliases = {}
    for player in nba + college:
        for alias in player.get("aliases", []):
            aliases[alias] = player["id"]
        player.pop("aliases", None)
    (OUT / "nba.json").write_text(json.dumps(nba, separators=(",", ":")))
    (OUT / "college.json").write_text(json.dumps(college, separators=(",", ":")))
    (OUT / "aliases.json").write_text(json.dumps(aliases, indent=2))
    print(f"wrote {len(nba)} nba, {len(college)} college, {len(aliases)} aliases")
    print("nba bytes", (OUT / "nba.json").stat().st_size)
    print("college bytes", (OUT / "college.json").stat().st_size)


if __name__ == "__main__":
    main()
