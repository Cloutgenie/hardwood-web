/** Mulberry32 — deterministic, fast, good enough for sports sims. */
export function createRng(seed: number) {
  let t = seed >>> 0;
  return function rng(): number {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

export function between(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function intBetween(rng: () => number, min: number, max: number): number {
  return Math.floor(between(rng, min, max + 1));
}

export function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function weightedPick<T>(
  rng: () => number,
  items: T[],
  weight: (item: T) => number,
): T {
  if (items.length === 0) {
    throw new Error("No players were on the floor for that play.");
  }
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0.01, weight(item));
    total += w;
    return w;
  });
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
