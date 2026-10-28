"use client";

import type { CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { GOSTOP_TITLE_DEFAULT, goStopBand, goStopRanking, type GoStopLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import board from "./overlay.module.css";
import styles from "./gameOverlay.module.css";

const RANKING_SHOWN = 5;
/** 고스톱 랭킹 as its own source (2026-10-28): more rows than the game card has room for. */
const RANKING_SOURCE_SHOWN = 10;

/**
 * The 풀 and GO count as OBS shows them at `now`: runs queue, so it is the latest shown result's (none: 0), or the 풀 now
 * once nothing is waiting (a 풀 비우기 shows then).
 */
export function goStopAt(gostop: GoStopLive, now: number) {
  if (!gostop.runs.some((r) => Date.parse(r.revealAt) > now)) return { pool: gostop.pool, go: gostop.go };
  const last = gostop.runs.find((r) => Date.parse(r.revealAt) <= now);
  return !last?.gostop || last.kind === "ADD" ? { pool: 0, go: 0 } : { pool: last.gostop.pool, go: last.gostop.go };
}

/**
 * 고스톱 overlay (`?gostop`): the 풀 (in its 색 구간) and the GO count, the result of each roll — "3 GO" with the 풀 and the
 * STOP 확률 it rolled, or "STOP!" with what it took — and the STOP 랭킹 (results shown so far). Without runs it waits.
 */
export function GoStopOverlay({ gostop, serverNow, reloadSeq, theme }: { gostop: GoStopLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!gostop || now === null) return null;
  const run = currentRun(gostop.runs, "GOSTOP", now);
  if (!run && !gostop.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const { pool, go } = goStopAt(gostop, now);
  const band = goStopBand(gostop.settings.bands, pool);
  const stop = run?.kind === "ADD";
  const sub = !run?.gostop
    ? ""
    : stop
      ? `${signedPoints(run.points)}${gostop.settings.multiplier > 1 ? ` (풀 ${formatNumber(run.gostop.pool)} × ${gostop.settings.multiplier})` : ""}`
      : `풀 ${formatNumber(run.gostop.pool)}점 · STOP 확률 ${run.gostop.chance}%`;
  const ranking = goStopRanking(gostop.wins.filter((w) => now >= Date.parse(w.revealAt))).slice(0, RANKING_SHOWN);
  return (
    <GameCard
      theme={theme}
      title={gostop.settings.title || GOSTOP_TITLE_DEFAULT}
      waiting={gostop.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub }}
      idle={`STOP 확률 1,000점당 ${gostop.settings.stopRate}% · 최대 ${gostop.settings.stopMax}%`}
      playing="GO? STOP?"
      wide
    >
      <div className={styles.gsPool} data-rolling={(!!run && !shown) || undefined} style={band ? ({ "--gs-color": band.color } as CSSProperties) : undefined}>
        <span className={ov.muted}>풀</span>
        <strong className={ov.display}>{formatNumber(pool)}</strong>
        <span className={styles.gsGo}>{go} GO</span>
      </div>
      {ranking.length > 0 && (
        <ol className={styles.gsRanking}>
          {ranking.map((r, i) => (
            <li key={r.memberId}>
              <span className={ov.muted}>{i + 1}</span>
              <span className={styles.gsName}>
                {r.color && <i className={board.dot} style={{ background: r.color }} aria-hidden="true" />}
                {r.name}
              </span>
              <span className={ov.muted}>STOP {r.count}</span>
              <strong>{formatNumber(r.points)}</strong>
            </li>
          ))}
        </ol>
      )}
    </GameCard>
  );
}

/**
 * 고스톱 진행 자막 (`?gostopticker`): one line — the 풀 in its 색 구간, the GO count, the STOP 확률 and the last STOP — as OBS
 * shows them now. With 대기 화면 off it stays empty until the first roll.
 */
export function GoStopTicker({ gostop, serverNow, reloadSeq, theme }: { gostop: GoStopLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!gostop || now === null || (!gostop.runs.length && !gostop.settings.showIdle)) return null;
  const { pool, go } = goStopAt(gostop, now);
  const band = goStopBand(gostop.settings.bands, pool);
  const last = gostop.wins.filter((w) => now >= Date.parse(w.revealAt)).at(-1);
  return (
    <OverlayThemeRoot theme={theme} className={board.pad}>
      <p className={`${ov.card} ${styles.gsTicker}`} style={band ? ({ "--gs-color": band.color } as CSSProperties) : undefined}>
        <strong className={ov.label}>🎴 {gostop.settings.title || GOSTOP_TITLE_DEFAULT}</strong>
        <span>
          풀 <b className={ov.display}>{formatNumber(pool)}</b>점
        </span>
        <span>{go} GO</span>
        {last && (
          <span>
            최근 STOP {last.name} {signedPoints(last.points)}
          </span>
        )}
        <span className={ov.muted}>STOP 1,000점당 {gostop.settings.stopRate}% · 최대 {gostop.settings.stopMax}%</span>
      </p>
    </OverlayThemeRoot>
  );
}

/**
 * 고스톱 랭킹 (`?gostoprank`, 2026-10-28 — StreamDonate gostop-ranking as its own source): the STOP 랭킹 since the last
 * 랭킹 리셋, results shown so far, up to RANKING_SOURCE_SHOWN members. With 대기 화면 off it stays empty until the first STOP.
 */
export function GoStopRankOverlay({ gostop, serverNow, reloadSeq, theme }: { gostop: GoStopLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!gostop || now === null) return null;
  const ranking = goStopRanking(gostop.wins.filter((w) => now >= Date.parse(w.revealAt))).slice(0, RANKING_SOURCE_SHOWN);
  if (!ranking.length && !gostop.settings.showIdle) return null;
  return (
    <OverlayThemeRoot theme={theme} className={board.pad}>
      <div className={`${ov.card} ${styles.rankCard}`}>
        <h1 className={`${ov.label} ${styles.rankTitle}`}>🎴 {gostop.settings.title || GOSTOP_TITLE_DEFAULT} 랭킹</h1>
        {ranking.length === 0 ? (
          <p className={ov.muted}>아직 STOP이 없어요</p>
        ) : (
          <ol className={styles.gsRanking}>
            {ranking.map((r, i) => (
              <li key={r.memberId}>
                <span className={ov.muted}>{i + 1}</span>
                <span className={styles.gsName}>
                  {r.color && <i className={board.dot} style={{ background: r.color }} aria-hidden="true" />}
                  {r.name}
                </span>
                <span className={ov.muted}>STOP {r.count}</span>
                <strong>{formatNumber(r.points)}</strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    </OverlayThemeRoot>
  );
}
