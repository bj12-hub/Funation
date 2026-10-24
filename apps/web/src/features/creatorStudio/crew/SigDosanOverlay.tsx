"use client";

import type { CSSProperties } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { SIG_DOSAN_TITLE_DEFAULT, type SigDosanLane, type SigDosanLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/**
 * 시그니처 두산 overlay (`?sigdosan`): the ladder from the highest step at the top down to the lowest, a column per lane (전체 ·
 * A팀 / B팀 · each member). A lane's step lights in its color once that run's result shows (it shoots up until then), its
 * next step waits outlined, and the winning lane is crowned. Without a board it waits (대기 중에도 보이기).
 */
export function SigDosanOverlay({ sigDosan, serverNow, reloadSeq, theme }: { sigDosan: SigDosanLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!sigDosan || now === null) return null;
  const board = sigDosan.board;
  const run = currentRun(sigDosan.runs, "SIG_DOSAN", now);
  if (!board && !run && !sigDosan.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const shownSteps = (lane: SigDosanLane) => lane.steps.filter((x) => now >= Date.parse(x.revealAt)).length;
  const won = board?.winner && now >= Date.parse(board.winner.revealAt) ? board.winner : null;
  const leader = board ? [...board.lanes].sort((x, y) => shownSteps(y) - shownSteps(x))[0] : null;
  const idle = !board
    ? "두산 시작 전이에요"
    : won
      ? `🏁 ${won.label} 완주!`
      : board.mode === "ALL"
        ? `${shownSteps(board.lanes[0])}/${board.ladder.length}단`
        : board.mode === "VS"
          ? `${board.lanes.map((l) => `${l.label} ${shownSteps(l)}`).join(" · ")} / ${board.ladder.length}단`
          : `1위 ${leader!.label} ${shownSteps(leader!)}/${board.ladder.length}단`;
  return (
    <GameCard
      theme={theme}
      title={sigDosan.settings.title || SIG_DOSAN_TITLE_DEFAULT}
      waiting={sigDosan.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run?.points ? signedPoints(run.points) : "" }}
      idle={idle}
      playing="발사!"
      wide
    >
      {board ? (
        <div className={styles.dosan} style={{ "--dosan-lanes": board.lanes.length } as CSSProperties} aria-hidden="true">
          <span />
          {board.lanes.map((lane) => (
            <span
              key={lane.key}
              className={styles.dosanHead}
              data-team={lane.key === "A" || lane.key === "B" ? lane.key : undefined}
              data-win={won?.lane === lane.key || undefined}
              style={lane.color ? ({ "--lane-color": lane.color } as CSSProperties) : undefined}
            >
              {won?.lane === lane.key && "👑 "}
              {lane.label}
            </span>
          ))}
          {board.ladder
            .map((step, i) => ({ step, i }))
            .reverse()
            .map(({ step, i }) => (
              <div key={step.signatureId} className={styles.dosanRow}>
                <span className={styles.dosanStep}>
                  {step.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
                    <img src={step.imageUrl} alt="" />
                  ) : (
                    <span className={styles.bingoName}>{step.signatureName}</span>
                  )}
                  <small>{formatNumber(step.price)}</small>
                </span>
                {board.lanes.map((lane) => {
                  const climbed = lane.steps[i];
                  const on = !!climbed && now >= Date.parse(climbed.revealAt);
                  return (
                    <span
                      key={lane.key}
                      className={styles.dosanCell}
                      data-team={lane.key === "A" || lane.key === "B" ? lane.key : undefined}
                      data-on={on || undefined}
                      data-shooting={(!!climbed && !on) || undefined}
                      data-next={(!climbed && lane.steps.length === i && !board.winner) || undefined}
                      style={lane.color ? ({ "--lane-color": lane.color } as CSSProperties) : undefined}
                    >
                      {on && i === board.ladder.length - 1 ? "🏁" : on ? "▲" : ""}
                    </span>
                  );
                })}
              </div>
            ))}
        </div>
      ) : (
        <div className={styles.sigStage}>
          <span className={styles.sigUnknown}>🚀</span>
        </div>
      )}
    </GameCard>
  );
}
