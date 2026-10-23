"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { GAME_TIMING, type GameKey, type GameRunView } from "@/services/crew/crewTypes";
import board from "./overlay.module.css";
import styles from "./gameOverlay.module.css";

/** Reel rows: copies of the items a strip runs through before it lands on the result. */
const LOOPS = 5;

/** Points with their sign: "+3,000점", "−2,000점". */
export const signedPoints = (n: number) => `${n < 0 ? "−" : "+"}${formatNumber(Math.abs(n))}점`;

/** The result line of a run: "×2 · +3,000점", "×2 · 기준 후원 없음", "+1,000점" / "−2,000점", "" for a 문구, "꽝" for a miss. */
export function gameEffect(r: Pick<GameRunView, "kind" | "value" | "points" | "basePoints">) {
  if (r.kind === "MULTIPLY") return r.basePoints ? `×${r.value} · ${signedPoints(r.points)}` : `×${r.value} · 기준 후원 없음`;
  if (r.kind === "ADD") return signedPoints(r.points);
  return r.kind === "MISS" ? "꽝" : "";
}

/** The run of `game` playing at `now` (its play or its result), if any. */
export function currentRun(runs: GameRunView[], game: GameKey, now: number) {
  const { playSec, resultSec } = GAME_TIMING[game];
  return runs.find((r) => Date.parse(r.showAt) <= now && now < Date.parse(r.showAt) + (playSec + resultSec) * 1000) ?? null;
}

/**
 * A reel strip, keyed by its run: scrolls through `items` and stops on `result` `sec` seconds after `showAt`. The start
 * offset is fixed when it mounts, so a page loaded mid-spin picks the reel up where it is.
 */
export function ReelStrip({ items, result, showAt, sec, now }: { items: string[]; result: string; showAt: string; sec: number; now: number }) {
  const [elapsed] = useState(() => Math.max(0, (now - Date.parse(showAt)) / 1000));
  const list = items.length ? items : [result];
  const strip = Array.from({ length: LOOPS }, () => list).flat();
  const target = (LOOPS - 2) * list.length + Math.max(0, list.indexOf(result));
  strip[target] = result;
  const style = { "--reel-end": `calc(var(--spin-row) * ${-(target - 1)})`, "--reel-sec": `${sec}s`, animationDelay: `-${elapsed}s` } as CSSProperties;
  return (
    <ol className={`${styles.strip} ${styles.spinning}`} style={style} aria-hidden="true">
      {strip.map((label, i) => (
        <li key={i} className={ov.display}>
          {label}
        </li>
      ))}
    </ol>
  );
}

/** A reel at rest on its first item. */
export function IdleStrip({ items }: { items: string[] }) {
  return (
    <ol className={styles.strip} aria-hidden="true">
      {[items.at(-1), items[0], items[1 % items.length]].map((label, i) => (
        <li key={i} className={ov.display}>
          {label}
        </li>
      ))}
    </ol>
  );
}

/**
 * The card every game overlay plays in: title + 대기 N, the game's stage (reels · dice), then who it is for and the result
 * once it shows (or the idle line between runs).
 */
export function GameCard({
  theme,
  title,
  waiting,
  run,
  shown,
  result,
  idle,
  playing,
  wide,
  children
}: {
  theme: ResolvedTheme;
  title: string;
  waiting: number;
  run: GameRunView | null;
  shown: boolean;
  /** The big result and the small line under it. */
  result: { main: string; sub: string };
  idle: string;
  playing: string;
  /** A wider card (시그 빙고 board). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <OverlayThemeRoot theme={theme} className={board.pad}>
      <div className={`${ov.card} ${styles.machine}`} data-wide={wide || undefined}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {title}
          {waiting > 0 && <span className={`${ov.chip} ${styles.queue}`}>대기 {waiting}</span>}
        </h1>
        {children}
        <p className={styles.result} role="status">
          {run ? (
            <>
              <span className={`${ov.label} ${styles.who}`}>
                {run.memberColor && <i className={board.dot} style={{ background: run.memberColor }} aria-hidden="true" />} {run.memberName}
                {run.trigger.kind === "SIGNATURE" && <span className={ov.muted}> · {run.trigger.signatureName}</span>}
                {run.trigger.kind === "AMOUNT" && (
                  <span className={ov.muted}>
                    {run.memberName ? " · " : ""}
                    {formatNumber(run.trigger.amount)} FN {run.game === "MEDLEY" ? "메들리" : "랜덤시그"}
                  </span>
                )}
              </span>
              {shown ? (
                <>
                  <strong key="hit" className={`${ov.enter} ${ov.display} ${styles.effect}`} data-motion="POP">
                    {result.main}
                  </strong>
                  {result.sub && <span className={ov.muted}>{result.sub}</span>}
                </>
              ) : (
                <span className={ov.muted}>{playing}</span>
              )}
            </>
          ) : (
            <span className={ov.muted}>{idle}</span>
          )}
        </p>
      </div>
    </OverlayThemeRoot>
  );
}
