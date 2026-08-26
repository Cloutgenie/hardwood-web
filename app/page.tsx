import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <p className="text-[11px] uppercase tracking-[0.25em] text-primary">
        The Dyme · Career cards · Possession sim
      </p>
      <h1 className="mt-3 max-w-3xl font-heading text-4xl uppercase leading-none tracking-wide sm:text-6xl">
        Build a roster. Tip it off. Watch the game happen.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
        Hardwood Sim treats basketball the way a baseball sim treats a box score: every rating is
        derived from a career line, then every possession is played out. The pool is the full
        historical set — every NBA/BAA career, and every D1 college career from 2008 on plus the
        older legends. College cards use college lines only. NBA cards use NBA lines only.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/build?league=nba">Build an NBA team</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/build?league=college">Build a college team</Link>
        </Button>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading uppercase tracking-wide">The card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              Each player is a 20–80 card, same idea as OOTP: 50 is a rotation regular in that
              league, 80 is historic. Finish, mid, three, pass, handle, IQ, perimeter D, interior D,
              glass, speed, strength.
            </p>
            <p>
              Ratings come from per-36 counting stats and shooting rates, using separate NBA and
              college baselines. Tiny samples regress toward average. High-usage creators are graded
              on turnovers per creation, not raw TOV. A 27-point college season is not mapped onto
              NBA scoring.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading uppercase tracking-wide">The game</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              The engine does not roll a final score. It calls a play — isolation, pick-and-roll,
              post, spot-up, cut, transition — then contests, blocks, fouls, free throws, and
              rebound battles.
            </p>
            <p>
              NBA games are 4×12 with a 24-second clock and six fouls. College games are 2×20 with
              a 30-second clock, the 1-and-1, and five fouls.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading uppercase tracking-wide">The pool</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              NBA cards are aggregated from Basketball-Reference season totals for every player who
              appeared in the BAA or NBA. College cards are every D1 player in the Barttorvik files
              (2008–26), plus pre-2008 legends. Search the pool — the list is too big to scroll.
            </p>
            <p>Load a preset (96 Bulls, 92 Duke, mid-major heat) or type any name and draft eight-to-twelve.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
