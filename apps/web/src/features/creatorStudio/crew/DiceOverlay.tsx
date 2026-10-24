"use client";

import { useEffect, useState } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { DICE_TITLE_DEFAULT, type DiceLive, type GameRunView } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/** Pip cells (of a 3 × 3 grid) for each face. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const IDLE: [number, number] = [6, 6];

/** A die. While rolling it tumbles through random faces (looks only — the server rolled the result). Also used by 스도폴리. */
export function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const [face, setFace] = useState(value);
  useEffect(() => {
    if (!rolling) {
      setFace(value);
      return;
    }
    const tick = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 110);
    return () => clearInterval(tick);
  }, [rolling, value]);
  const shown = rolling ? face : value;
  return (
    <span className={styles.die} data-rolling={rolling || undefined} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} data-on={PIPS[shown].includes(i) || undefined} />
      ))}
    </span>
  );
}

/** "4 + 4 더블 · +8,000점" under the big ×8. */
const diceLine = (r: GameRunView) => `${r.label} · ${r.basePoints ? `+${formatNumber(r.points)}점` : "기준 후원 없음"}`;

/**
 * 주사위 게임 overlay (`?dice`): queued runs play one after another — two dice tumble, land on the server's roll, then the
 * 배수 and the points show. Between runs the dice rest (대기 중에도 보이기), or the page stays empty.
 */
export function DiceOverlay({ dice, serverNow, reloadSeq, theme }: { dice: DiceLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!dice || now === null) return null;
  const run = currentRun(dice.runs, "DICE", now);
  if (!run && !dice.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const [a, b] = run?.dice ?? IDLE;
  return (
    <GameCard
      theme={theme}
      title={dice.settings.title || DICE_TITLE_DEFAULT}
      waiting={dice.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run ? `×${run.value}` : "", sub: run ? diceLine(run) : "" }}
      idle="시그니처를 기다리는 중"
      playing="굴리는 중…"
    >
      <div className={styles.dice} data-double={(shown && a === b) || undefined}>
        <Die key={`${run?.id ?? "idle"}-a`} value={a} rolling={!!run && !shown} />
        <Die key={`${run?.id ?? "idle"}-b`} value={b} rolling={!!run && !shown} />
      </div>
    </GameCard>
  );
}
