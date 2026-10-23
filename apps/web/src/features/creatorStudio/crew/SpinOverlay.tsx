"use client";

import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { GAME_TIMING, SPIN_TITLE_DEFAULT, type SpinLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, IdleStrip, ReelStrip, currentRun, gameEffect } from "./GameOverlayParts";
import board from "./overlay.module.css";
import styles from "./gameOverlay.module.css";

/**
 * 스핀머신 overlay (`?spin`): queued runs play one after another — the reel spins, then the member and the result show.
 * Between runs the machine rests on the first item (대기 중에도 보이기), or the page stays empty. Timed on the server clock.
 */
export function SpinMachineOverlay({ spin, serverNow, reloadSeq, theme }: { spin: SpinLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!spin || now === null) return null;
  const labels = spin.settings.items.map((i) => i.label);
  const run = currentRun(spin.runs, "SPIN", now);
  if (!run && (!spin.settings.showIdle || !labels.length)) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  return (
    <GameCard
      theme={theme}
      title={spin.settings.title || SPIN_TITLE_DEFAULT}
      waiting={spin.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.kind === "TEXT" ? run.label : run ? gameEffect(run) : "", sub: "" }}
      idle="시그니처를 기다리는 중"
      playing="돌리는 중…"
    >
      <div className={styles.window} data-hit={shown || undefined}>
        {run ? <ReelStrip key={run.id} items={labels} result={run.label} showAt={run.showAt} sec={GAME_TIMING.SPIN.playSec} now={now} /> : <IdleStrip items={labels} />}
      </div>
    </GameCard>
  );
}

/** 스핀머신 BJ별 집계 overlay (`?spintally`): how many times each member got each 문구 result (nothing until the first). */
export function SpinTallyOverlay({ spin, reloadSeq, theme }: { spin: SpinLive | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  if (!spin || !spin.tally.rows.length) return null;
  const { columns, rows } = spin.tally;
  const count = (n: number) => <span className={n === 0 ? board.sigZero : ov.display}>{formatNumber(n)}</span>;
  return (
    <OverlayThemeRoot theme={theme} className={board.pad}>
      <div className={`${ov.card} ${board.board} ${board.sigCount}`}>
        <h1 className={`${ov.label} ${board.title}`}>{spin.settings.title || SPIN_TITLE_DEFAULT} 집계</h1>
        <table className={board.sigTable}>
          <thead>
            <tr>
              <th scope="col" aria-label="멤버" />
              {columns.map((c) => (
                <th key={c} scope="col">
                  <span className={`${ov.muted} ${board.sigHead}`}>{c}</span>
                </th>
              ))}
              {columns.length > 1 && (
                <th scope="col">
                  <span className={`${ov.muted} ${board.sigHead}`}>합계</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.memberId}>
                <th scope="row" className={`${ov.label} ${board.name}`}>
                  {r.color && <i className={board.dot} style={{ background: r.color }} aria-hidden="true" />} {r.name}
                </th>
                {r.counts.map((n, i) => (
                  <td key={columns[i]}>{count(n)}</td>
                ))}
                {columns.length > 1 && <td>{count(r.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OverlayThemeRoot>
  );
}
