"use client";

import type { CSSProperties } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { SUDOPOLY_TITLE_DEFAULT, sudopolyCell, type GameRunView, type SudopolyLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { Die } from "./DiceOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/** Where each piece is as OBS shows it at `now`: before its first roll still waiting (runs queue), else where it is now. */
export function sudopolyPositions(sudopoly: SudopolyLive, now: number) {
  return sudopoly.pieces.map((p) => {
    const waiting = sudopoly.runs.filter((r: GameRunView) => r.move?.piece === p.key && Date.parse(r.revealAt) > now).at(-1);
    return { ...p, pos: waiting ? waiting.move!.from : p.pos };
  });
}

/**
 * 스도폴리 overlay (`?sudopoly`): the square board (출발 bottom-right, the 칸 kinds in their colors) with the pieces on it —
 * each moves once its roll's result shows — and the two dice in the middle, tumbling while a roll plays. The result shows
 * below (the 칸 · card and its points). Without 칸 the page stays empty.
 */
export function SudopolyOverlay({ sudopoly, serverNow, reloadSeq, theme }: { sudopoly: SudopolyLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!sudopoly || now === null || !sudopoly.settings.spaces.length) return null;
  const run = currentRun(sudopoly.runs, "SUDOPOLY", now);
  if (!run && !sudopoly.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const { spaces } = sudopoly.settings;
  const side = spaces.length / 4;
  const pieces = sudopolyPositions(sudopoly, now);
  const dice = run?.dice ?? [6, 6];
  return (
    <GameCard
      theme={theme}
      title={sudopoly.settings.title || SUDOPOLY_TITLE_DEFAULT}
      waiting={sudopoly.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run ? `🎲 ${dice[0]} + ${dice[1]}${dice[0] === dice[1] ? " 더블" : ""}${run.points ? ` · ${signedPoints(run.points)}` : ""}` : "" }}
      idle={sudopoly.pieces.length === 1 ? `${sudopoly.pieces[0].name} · ${formatNumber(sudopoly.pieces[0].laps)}바퀴` : "다음 주사위를 기다려요"}
      playing="주사위 굴리는 중…"
      wide
    >
      <div className={styles.sdBoard} style={{ "--sd-cells": side + 1 } as CSSProperties} aria-hidden="true">
        {spaces.map((x, i) => {
          const { row, col } = sudopolyCell(spaces.length, i);
          const here = pieces.filter((p) => p.pos === i);
          return (
            <div key={x.id} className={styles.sdCell} data-kind={x.kind} data-sign={x.kind === "POINTS" ? (x.value > 0 ? "+" : "-") : undefined} style={{ gridRow: row + 1, gridColumn: col + 1 }}>
              <span className={styles.sdLabel}>{x.label}</span>
              {here.length > 0 && (
                <span className={styles.sdPieces}>
                  {here.map((p) => (
                    <i key={p.key} style={p.color ? ({ "--piece-color": p.color } as CSSProperties) : undefined} title={p.name} data-emoji={p.emoji ? "" : undefined}>
                      {p.emoji ?? p.name.slice(0, 1)}
                    </i>
                  ))}
                </span>
              )}
            </div>
          );
        })}
        <div className={styles.sdCenter} style={{ gridRow: `2 / span ${side - 1}`, gridColumn: `2 / span ${side - 1}` }}>
          <Die key={`a-${run?.id ?? "idle"}`} value={dice[0]} rolling={!!run && !shown} />
          <Die key={`b-${run?.id ?? "idle"}`} value={dice[1]} rolling={!!run && !shown} />
        </div>
      </div>
    </GameCard>
  );
}
