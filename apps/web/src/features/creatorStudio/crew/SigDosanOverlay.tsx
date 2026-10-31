"use client";

import type { CSSProperties } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { SIG_DOSAN_TITLE_DEFAULT, type SigDosanBoard, type SigDosanLane, type SigDosanLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/**
 * 시그니처 두산 overlay (`?sigdosan`), in the saved 표시 방식 — 롤러 (`DosanRoller`) or 사다리: the ladder from the highest step
 * at the top down to the lowest, a column per lane (전체 · A팀 / B팀 · each member). A lane's step lights in its color once that
 * run's result shows (it shoots up until then), its next step waits outlined, and the winning lane is crowned. Without a
 * board it waits (대기 중에도 보이기).
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
      columns={board && sigDosan.settings.display === "ROLLER" && board.lanes.length > 1 ? Math.min(board.lanes.length, 3) : undefined}
    >
      {board && sigDosan.settings.display === "ROLLER" ? (
        <DosanRoller board={board} won={won} shownSteps={shownSteps} />
      ) : board ? (
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

/**
 * 롤러 (2026-10-30, StreamDonate 시그니처 두산의 원본 연출): each lane a window on a strip of the ladder's cards, the lowest
 * price on top — the card it shoots next in full color (pulsing while a shot waits for its result), the rest in gray; a
 * shown step rolls the strip up a card (the shot one goes up and out, the next comes up from below). A lane at the top shows CLEAR (전체: ALL CLEAR); the
 * other lanes dim once a lane wins.
 */
function DosanRoller({ board, won, shownSteps }: { board: SigDosanBoard; won: SigDosanBoard["winner"]; shownSteps: (lane: SigDosanLane) => number }) {
  const total = board.ladder.length;
  return (
    <div className={styles.roller} style={{ "--roll-cols": Math.min(board.lanes.length, 4) } as CSSProperties} aria-hidden="true">
      {board.lanes.map((lane) => {
        const done = shownSteps(lane);
        const team = lane.key === "A" || lane.key === "B" ? lane.key : undefined;
        return (
          <div key={lane.key} className={styles.rollLane} data-out={(!!won && won.lane !== lane.key) || undefined}>
            {board.mode !== "ALL" && (
              <span
                className={styles.dosanHead}
                data-team={team}
                data-win={won?.lane === lane.key || undefined}
                style={lane.color ? ({ "--lane-color": lane.color } as CSSProperties) : undefined}
              >
                {won?.lane === lane.key && "👑 "}
                {lane.label}
              </span>
            )}
            <div className={styles.rollWindow}>
              {done >= total ? (
                <div className={styles.rollClear}>
                  <span>{board.mode === "ALL" ? "🎉" : "🏆"}</span>
                  <strong>{board.mode === "ALL" ? "ALL CLEAR!" : "CLEAR!"}</strong>
                  <small>{total}개 시그니처 완료</small>
                </div>
              ) : (
                <>
                  <span className={styles.rollBadge}>
                    {done + 1} / {total}
                  </span>
                  <div className={styles.rollStrip} style={{ transform: `translateY(${(-100 * done) / total}%)` }}>
                    {board.ladder.map((step, i) => (
                      <div
                        key={step.signatureId}
                        className={styles.rollCard}
                        data-current={i === done || undefined}
                        data-shooting={(i === done && lane.steps.length > done) || undefined}
                      >
                        {step.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
                          <img src={step.imageUrl} alt="" />
                        ) : (
                          <span className={styles.rollPlaceholder}>{step.signatureName}</span>
                        )}
                        <span className={styles.rollCaption}>
                          <b>{step.signatureName}</b>
                          <i>{formatNumber(step.price)} FN</i>
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
