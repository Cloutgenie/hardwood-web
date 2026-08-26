from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LIB_DATA = ROOT / "lib" / "data"

# Canonical college aliases (same as the original sim).
COLLEGE_ALIASES: dict[str, str] = {
    "unc": "North Carolina",
    "north carolina": "North Carolina",
    "duke": "Duke",
    "kansas": "Kansas",
    "uk": "Kentucky",
    "kentucky": "Kentucky",
    "ucla": "UCLA",
    "iu": "Indiana",
    "indiana": "Indiana",
    "msu": "Michigan State",
    "michigan state": "Michigan State",
    "michigan": "Michigan",
    "syracuse": "Syracuse",
    "uconn": "UConn",
    "connecticut": "UConn",
    "villanova": "Villanova",
    "nova": "Villanova",
    "louisville": "Louisville",
    "georgetown": "Georgetown",
    "arizona": "Arizona",
    "florida": "Florida",
    "ohio state": "Ohio State",
    "osu": "Ohio State",
    "purdue": "Purdue",
    "houston": "Houston",
    "memphis": "Memphis",
    "unlv": "UNLV",
    "gonzaga": "Gonzaga",
    "marquette": "Marquette",
    "st. john's": "St. John's",
    "st johns": "St. John's",
    "arkansas": "Arkansas",
    "oklahoma": "Oklahoma",
    "texas": "Texas",
    "kansas state": "Kansas State",
    "wake forest": "Wake Forest",
    "nc state": "NC State",
    "north carolina state": "NC State",
    "georgia tech": "Georgia Tech",
    "virginia": "Virginia",
    "maryland": "Maryland",
    "seton hall": "Seton Hall",
    "depaul": "DePaul",
    "cincinnati": "Cincinnati",
    "memphis state": "Memphis",
    "san francisco": "San Francisco",
    "seattle": "Seattle",
    "holy cross": "Holy Cross",
    "la salle": "La Salle",
    "bradley": "Bradley",
    "wyoming": "Wyoming",
    "utah": "Utah",
    "byu": "BYU",
    "brigham young": "BYU",
    "lsu": "LSU",
    "louisiana state": "LSU",
    "alabama": "Alabama",
    "auburn": "Auburn",
    "tennessee": "Tennessee",
    "south carolina": "South Carolina",
    "ole miss": "Ole Miss",
    "mississippi": "Ole Miss",
    "mississippi state": "Mississippi State",
    "vanderbilt": "Vanderbilt",
    "missouri": "Missouri",
    "iowa": "Iowa",
    "iowa state": "Iowa State",
    "illinois": "Illinois",
    "wisconsin": "Wisconsin",
    "minnesota": "Minnesota",
    "northwestern": "Northwestern",
    "penn state": "Penn State",
    "nebraska": "Nebraska",
    "oregon": "Oregon",
    "oregon state": "Oregon State",
    "washington": "Washington",
    "washington state": "Washington State",
    "stanford": "Stanford",
    "cal": "California",
    "california": "California",
    "usc": "USC",
    "arizona state": "Arizona State",
    "colorado": "Colorado",
    "utah state": "Utah State",
    "new mexico": "New Mexico",
    "tcu": "TCU",
    "baylor": "Baylor",
    "texas a&m": "Texas A&M",
    "texas tech": "Texas Tech",
    "oklahoma state": "Oklahoma State",
    "creighton": "Creighton",
    "xavier": "Xavier",
    "dayton": "Dayton",
    "butler": "Butler",
    "vcu": "VCU",
    "richmond": "Richmond",
    "davidson": "Davidson",
    "wichita state": "Wichita State",
    "temple": "Temple",
    "penn": "Penn",
    "princeton": "Princeton",
    "yale": "Yale",
    "harvard": "Harvard",
    "columbia": "Columbia",
    "cornell": "Cornell",
    "brown": "Brown",
    "dartmouth": "Dartmouth",
    "notre dame": "Notre Dame",
    "boston college": "Boston College",
    "providence": "Providence",
    "st. joseph's": "Saint Joseph's",
    "saint joseph's": "Saint Joseph's",
    "st josephs": "Saint Joseph's",
    "miami": "Miami",
    "miami (fl)": "Miami",
    "florida state": "Florida State",
    "fsu": "Florida State",
    "clemson": "Clemson",
    "georgia": "Georgia",
    "west virginia": "West Virginia",
    "pittsburgh": "Pittsburgh",
    "pitt": "Pittsburgh",
    "rutgers": "Rutgers",
    "virginia tech": "Virginia Tech",
    "smu": "SMU",
    "tulane": "Tulane",
    "tulsa": "Tulsa",
    "wichita": "Wichita State",
    "loyola chicago": "Loyola Chicago",
    "loyola (il)": "Loyola Chicago",
    "de paul": "DePaul",
    "st. louis": "Saint Louis",
    "saint louis": "Saint Louis",
    "duquesne": "Duquesne",
    "canisius": "Canisius",
    "niagara": "Niagara",
    "iona": "Iona",
    "manhattan": "Manhattan",
    "fordham": "Fordham",
    "st. bonaventure": "St. Bonaventure",
    "st bonaventure": "St. Bonaventure",
    "siena": "Siena",
    "hofstra": "Hofstra",
    "northeastern": "Northeastern",
    "boston university": "Boston University",
    "umass": "UMass",
    "massachusetts": "UMass",
    "rhode island": "Rhode Island",
    "george washington": "George Washington",
    "american": "American",
    "navy": "Navy",
    "army": "Army",
    "air force": "Air Force",
    "charlotte": "Charlotte",
    "unc charlotte": "Charlotte",
    "old dominion": "Old Dominion",
    "vcu rams": "VCU",
    "george mason": "George Mason",
    "james madison": "James Madison",
    "richmond spiders": "Richmond",
    "william & mary": "William & Mary",
    "william and mary": "William & Mary",
    "east carolina": "East Carolina",
    "south florida": "South Florida",
    "ucf": "UCF",
    "central florida": "UCF",
    "fau": "FAU",
    "florida atlantic": "FAU",
    "fiu": "FIU",
    "miami (oh)": "Miami (OH)",
    "ohio": "Ohio",
    "akron": "Akron",
    "kent state": "Kent State",
    "bowling green": "Bowling Green",
    "toledo": "Toledo",
    "western michigan": "Western Michigan",
    "eastern michigan": "Eastern Michigan",
    "central michigan": "Central Michigan",
    "ball state": "Ball State",
    "northern illinois": "Northern Illinois",
    "illinois state": "Illinois State",
    "indiana state": "Indiana State",
    "southern illinois": "Southern Illinois",
    "bradley braves": "Bradley",
    "drake": "Drake",
    "missouri state": "Missouri State",
    "evansville": "Evansville",
    "valparaiso": "Valparaiso",
    "oakland": "Oakland",
    "detroit": "Detroit Mercy",
    "detroit mercy": "Detroit Mercy",
    "wright state": "Wright State",
    "cleveland state": "Cleveland State",
    "youngstown state": "Youngstown State",
    "green bay": "Green Bay",
    "milwaukee": "Milwaukee",
    "uw-milwaukee": "Milwaukee",
    "uw-green bay": "Green Bay",
    "northern iowa": "Northern Iowa",
    "uni": "Northern Iowa",
    "wichita st": "Wichita State",
    "new mexico state": "New Mexico State",
    "nmsu": "New Mexico State",
    "utep": "UTEP",
    "utep miners": "UTEP",
    "utsa": "UTSA",
    "texas-san antonio": "UTSA",
    "north texas": "North Texas",
    "louisiana tech": "Louisiana Tech",
    "southern miss": "Southern Miss",
    "middle tennessee": "Middle Tennessee",
    "western kentucky": "Western Kentucky",
    "wku": "Western Kentucky",
    "murray state": "Murray State",
    "austin peay": "Austin Peay",
    "belmont": "Belmont",
    "lipscomb": "Lipscomb",
    "tennessee state": "Tennessee State",
    "tennessee tech": "Tennessee Tech",
    "morehead state": "Morehead State",
    "eastern kentucky": "Eastern Kentucky",
    "jacksonville state": "Jacksonville State",
    "samford": "Samford",
    "chattanooga": "Chattanooga",
    "furman": "Furman",
    "wofford": "Wofford",
    "unc greensboro": "UNC Greensboro",
    "east tennessee state": "East Tennessee State",
    "etsu": "East Tennessee State",
    "mercer": "Mercer",
    "the citadel": "The Citadel",
    "vmi": "VMI",
    "western carolina": "Western Carolina",
    "appalachian state": "Appalachian State",
    "coastal carolina": "Coastal Carolina",
    "college of charleston": "College of Charleston",
    "charleston": "College of Charleston",
    "unc wilmington": "UNC Wilmington",
    "elon": "Elon",
    "towson": "Towson",
    "drexel": "Drexel",
    "delaware": "Delaware",
    "hofstra pride": "Hofstra",
    "william & mary tribe": "William & Mary",
    "james madison dukes": "James Madison",
    "northeastern huskies": "Northeastern",
    "stony brook": "Stony Brook",
    "albany": "Albany",
    "vermont": "Vermont",
    "new hampshire": "New Hampshire",
    "maine": "Maine",
    "umbc": "UMBC",
    "binghamton": "Binghamton",
    "hartford": "Hartford",
    "sacred heart": "Sacred Heart",
    "fairfield": "Fairfield",
    "iona gaels": "Iona",
    "manhattan jaspers": "Manhattan",
    "marist": "Marist",
    "monmouth": "Monmouth",
    "niagara purple eagles": "Niagara",
    "quinnipiac": "Quinnipiac",
    "rider": "Rider",
    "saint peter's": "Saint Peter's",
    "st. peter's": "Saint Peter's",
    "siena saints": "Siena",
}


def slug(s: str) -> str:
    s = s.lower().strip()
    s = s.replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def canon_college(raw: str | None) -> str | None:
    if not raw:
        return None
    key = re.sub(r"\s+", " ", raw.strip().lower())
    key = key.replace(".", "")
    return COLLEGE_ALIASES.get(key, raw.strip())


def load_json(path: Path):
    return json.loads(path.read_text())


def write_ts(path: Path, export_name: str, payload: object) -> None:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path.write_text(f"export const {export_name} = {body} as const;\n")


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def build_nba() -> None:
    raw = load_json(DATA / "nba.json")
    out = []
    for p in raw:
        out.append(
            {
                "id": p["id"],
                "fullName": p["fullName"],
                "firstName": p.get("firstName"),
                "lastName": p.get("lastName"),
                "fromYear": p.get("fromYear"),
                "toYear": p.get("toYear"),
                "isActive": bool(p.get("isActive")),
                "position": p.get("position"),
                "heightInches": p.get("heightInches"),
                "weightLbs": p.get("weightLbs"),
                "draftYear": p.get("draftYear"),
                "draftRound": p.get("draftRound"),
                "draftNumber": p.get("draftNumber"),
                "career": p.get("career") or {},
                "seasons": p.get("seasons") or [],
                "awards": p.get("awards") or [],
                "source": p.get("source") or "nba-stats",
            }
        )
    LIB_DATA.mkdir(parents=True, exist_ok=True)
    write_ts(LIB_DATA / "nba.ts", "NBA_PLAYERS", out)
    print(f"nba.ts  {len(out)} players")


def build_college() -> None:
    raw = load_json(DATA / "college.json")
    # group by (fullName, college)
    grouped: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in raw:
        name = (r.get("fullName") or "").strip()
        college = canon_college(r.get("college"))
        if not name or not college:
            continue
        grouped[(name, college)].append(r)

    out = []
    for (name, college), rows in grouped.items():
        seasons = []
        for r in rows:
            seasons.append(
                {
                    "season": r.get("season"),
                    "school": college,
                    "g": r.get("g"),
                    "gs": r.get("gs"),
                    "mp": r.get("mp"),
                    "fg": r.get("fg"),
                    "fga": r.get("fga"),
                    "fgPct": r.get("fgPct"),
                    "fg3": r.get("fg3"),
                    "fg3a": r.get("fg3a"),
                    "fg3Pct": r.get("fg3Pct"),
                    "fg2": r.get("fg2"),
                    "fg2a": r.get("fg2a"),
                    "fg2Pct": r.get("fg2Pct"),
                    "efgPct": r.get("efgPct"),
                    "ft": r.get("ft"),
                    "fta": r.get("fta"),
                    "ftPct": r.get("ftPct"),
                    "orb": r.get("orb"),
                    "drb": r.get("drb"),
                    "trb": r.get("trb"),
                    "ast": r.get("ast"),
                    "stl": r.get("stl"),
                    "blk": r.get("blk"),
                    "tov": r.get("tov"),
                    "pf": r.get("pf"),
                    "pts": r.get("pts"),
                    "sos": r.get("sos"),
                }
            )
        # career rollup (simple weighted-ish: use last season as identity + totals)
        career_g = sum(s.get("g") or 0 for s in seasons)
        career_pts = sum((s.get("pts") or 0) * (s.get("g") or 0) for s in seasons)
        career_trb = sum((s.get("trb") or 0) * (s.get("g") or 0) for s in seasons)
        career_ast = sum((s.get("ast") or 0) * (s.get("g") or 0) for s in seasons)
        ppg = (career_pts / career_g) if career_g else None
        rpg = (career_trb / career_g) if career_g else None
        apg = (career_ast / career_g) if career_g else None
        pid = f"cbb:{slug(name)}:{slug(college)}"
        out.append(
            {
                "id": pid,
                "fullName": name,
                "college": college,
                "seasons": seasons,
                "career": {"g": career_g, "ppg": ppg, "rpg": rpg, "apg": apg},
                "source": "sports-reference-cbb",
            }
        )
    write_ts(LIB_DATA / "college.ts", "COLLEGE_PLAYERS", out)
    print(f"college.ts  {len(out)} players")


if __name__ == "__main__":
    build_nba()
    build_college()
