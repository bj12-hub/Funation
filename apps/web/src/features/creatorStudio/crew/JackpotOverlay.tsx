"use client";

import type { CSSProperties } from "react";
import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { JACKPOT_TITLE_DEFAULT, type JackpotLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/**
 * The 풀 as OBS shows it at `now`: runs queue, so it is the latest shown result's (a 당첨: a new, empty 풀), or the 풀 now
 * once nothing is waiting (a 풀 새로 시작 shows then).
 */
export function jackpotAt(jackpot: JackpotLive, now: number) {
  if (!jackpot.runs.some((r) => Date.parse(r.revealAt) > now)) return { pool: jackpot.pool, count: jackpot.count, fill: jackpot.fill };
  const last = jackpot.runs.find((r) => Date.parse(r.revealAt) <= now);
  return !last?.jackpot || last.jackpot.won ? { pool: 0, count: 0, fill: 0 } : { pool: last.jackpot.pool, count: last.jackpot.count, fill: last.jackpot.fill };
}

/**
 * 시그니처 잭팟 overlay (`?jackpot`, 2026-11-01 — StreamDonate 복주머니 모드 as a 점수 풀): the 복주머니 with the 풀 and its 순번,
 * swelling as the 순번 nears the 당첨 순번 (OBS only knows how near, in tenths); each 시그니처 후원 drops in, and a 당첨 bursts
 * it with the member and the points for the 당첨 문구 표시 시간. Without runs it waits (대기 중에도 보이기).
 */
export function JackpotOverlay({ jackpot, serverNow, reloadSeq, theme }: { jackpot: JackpotLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!jackpot || now === null) return null;
  const run = currentRun(jackpot.runs, "JACKPOT", now);
  // A 당첨 stays up for the 당첨 문구 표시 시간 after its result shows (longer than the game's own result time).
  const win = jackpot.runs.find((r) => r.jackpot?.won && Date.parse(r.revealAt) <= now && now < Date.parse(r.revealAt) + jackpot.settings.showSec * 1000) ?? null;
  if (!run && !win && !jackpot.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const { pool, count, fill } = jackpotAt(jackpot, now);
  return (
    <GameCard
      theme={theme}
      title={jackpot.settings.title || JACKPOT_TITLE_DEFAULT}
      waiting={jackpot.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run?.jackpot?.won ? signedPoints(run.points) : run?.jackpot ? `풀 ${formatNumber(run.jackpot.pool)}점` : "" }}
      idle={`이번 풀 ${formatNumber(count)}번째`}
      playing="복주머니에 쏙!"
    >
      <div className={styles.jpStage} aria-hidden="true">
        {win ? (
          <div className={styles.jpWin}>
            <span className={styles.jpBurst}>🎉</span>
            <strong className={ov.display}>{win.memberName || "당첨"}</strong>
            <span>{signedPoints(win.points)}</span>
          </div>
        ) : (
          <span className={styles.jpPouch} data-dropping={(!!run && !shown) || undefined} style={{ "--jp-fill": fill } as CSSProperties}>
            🧧
          </span>
        )}
      </div>
      <div className={styles.jpPool}>
        <span className={ov.muted}>풀</span>
        <strong className={ov.display}>{formatNumber(pool)}</strong>
        <span className={styles.jpCount}>{formatNumber(count)}번째</span>
      </div>
    </GameCard>
  );
}
