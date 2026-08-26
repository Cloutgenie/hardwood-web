# Hardwood Sim

A possession-level basketball simulator. You build two rosters from **career cards**, tip the ball, and watch a play-by-play plus a full box score.

It is built like a baseball sim, not a 2K slider set: the score is what happens after a few hundred individual plays, not a single random roll.

## Two leagues, two contexts

- **NBA teams** are rated from NBA/BAA regular-season career lines — every player who appeared.
- **College teams** are rated from college career lines only — every D1 player in the 2008–26 Barttorvik files, plus pre-2008 legends.

Steph Curry at Davidson and Steph Curry in the NBA are different cards. Zion’s Duke season is not his Pelicans career. A game is always NBA vs NBA or college vs college.

## How a card is built

Season totals are aggregated into a career per-game line, then mapped onto a **20–80** scale:

| Band | Meaning |
| --- | --- |
| 50 | Rotation regular in that league |
| 65 | Plus starter |
| 75–80 | Historic / elite |

NBA totals come from the public Basketball-Reference season dump. College totals come from Barttorvik’s D1 player files. Pre-steal/block era NBA players (Russell, Wilt, Oscar) get documented defensive boosts so missing official stats do not zero them out.

## How a game is played

The engine walks the clock: lineup, play call, contest, block, steal, shot, foul, free throws, rebound. NBA is 4×12 with a 24-second clock. College is 2×20 with a 30-second clock and the 1-and-1.

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43173/hardwoodsim](http://127.0.0.1:43173/hardwoodsim). Search any name, or load a preset, then tip off.

The app is mounted at `/hardwoodsim` so it can live at [thedyme.net/hardwoodsim](https://thedyme.net/hardwoodsim). The Dyme project is CLI-deployed; add this to its `vercel.json` (or `next.config` rewrites) and redeploy The Dyme:

```json
{
  "rewrites": [
    {
      "source": "/hardwoodsim",
      "destination": "https://hoop-sim-cloutgenies-projects.vercel.app/hardwoodsim"
    },
    {
      "source": "/hardwoodsim/:path*",
      "destination": "https://hoop-sim-cloutgenies-projects.vercel.app/hardwoodsim/:path*"
    }
  ]
}
```

Promote the Hardwood Sim Vercel project to Production first so that destination is public.

```bash
npm run catalog  # rebuild data/ from the public dumps
npm run sanity
npm run build
```

Vercel builds run `python3 scripts/build_catalog.py` before `next build` so the catalog is generated in CI from those same public dumps.

## Pool

- About 5,100 NBA/BAA career cards
- About 35,000 college cards
- Type to search. The builder does not try to render the entire list.
