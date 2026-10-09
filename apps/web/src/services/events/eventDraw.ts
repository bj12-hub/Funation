import { randomInt } from "node:crypto";

/**
 * 당첨자 추첨 (2026-10-08 결정) — server-only (node:crypto; never import it from a module the browser loads). A fair
 * draw: `count` distinct entries of `pool`, every entry equally likely, by a partial Fisher–Yates shuffle with the CSPRNG.
 * Asking for more than the pool draws the whole pool. `pick(max)` returns an integer in [0, max) — a test can pass its own.
 */
export function drawWinners<T>(pool: readonly T[], count: number, pick: (max: number) => number = (max) => randomInt(max)): T[] {
  const a = [...pool];
  const n = Math.max(0, Math.min(Math.floor(count), a.length));
  for (let i = 0; i < n; i++) {
    const j = i + pick(a.length - i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
