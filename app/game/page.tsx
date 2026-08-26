"use client";

import dynamic from "next/dynamic";

const GameClient = dynamic(
  () => import("@/components/game-client").then((mod) => mod.GameClient),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-muted-foreground">
        Tipping off…
      </div>
    ),
  },
);

export default function GamePage() {
  return <GameClient />;
}
