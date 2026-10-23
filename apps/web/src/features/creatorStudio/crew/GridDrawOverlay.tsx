"use client";

import type { CSSProperties } from "react";
import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { GRID_DRAW_TITLE_DEFAULT, type GridDrawCell, type GridDrawLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/**
 * 복불복 뽑기판 overlay (`?griddraw`): the board — closed cells show their number (the prizes stay on the server), a cell
 * being opened shakes until its run's result, then shows the prize (a signature's image, a 문구, 점수 or 꽝) framed in the
 * opener's color, the last one popping. Without a board it waits (대기 중에도 보이기), or the page stays empty.
 */
export function GridDrawOverlay({ gridDraw, serverNow, reloadSeq, theme }: { gridDraw: GridDrawLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!gridDraw || now === null) return null;
  const board = gridDraw.board;
  const run = currentRun(gridDraw.runs, "GRID_DRAW", now);
  if (!board && !run && !gridDraw.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const revealed = (c: GridDrawCell) => !!c.opened && now >= Date.parse(c.opened.revealAt);
  const closed = board ? board.cells.filter((c) => !revealed(c)).length : 0;
  const sub = !run ? "" : run.points ? signedPoints(run.points) : run.kind === "MISS" ? "" : run.itemId ? "시그니처 당첨" : "당첨!";
  return (
    <GameCard
      theme={theme}
      title={gridDraw.settings.title || GRID_DRAW_TITLE_DEFAULT}
      waiting={gridDraw.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub }}
      idle={board ? `남은 칸 ${closed}/${board.cells.length}` : "뽑기판 시작 전이에요"}
      playing="두근두근…"
      wide
    >
      {board ? (
        <ol className={styles.bingoGrid} style={{ "--bingo-size": board.size } as CSSProperties} aria-hidden="true">
          {board.cells.map((c, i) => {
            const open = revealed(c);
            return (
              <li
                key={i}
                className={`${styles.bingoCell} ${styles.drawTile}`}
                data-open={open ? "" : undefined}
                data-opening={(!!c.opened && !open) || undefined}
                data-miss={(open && c.kind === "MISS") || undefined}
                data-last={(open && board.lastOpened === i) || undefined}
                style={open && c.opened?.memberColor ? ({ "--cell-color": c.opened.memberColor } as CSSProperties) : undefined}
              >
                {!open ? (
                  <span className={`${ov.display} ${styles.drawNo}`}>{i + 1}</span>
                ) : c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
                  <img src={c.imageUrl} alt="" />
                ) : (
                  <span className={styles.bingoName}>
                    {c.kind === "MISS" ? "꽝" : c.label}
                    {c.kind === "POINTS" && <b>+{formatNumber(c.points)}</b>}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.sigStage}>
          <span className={styles.sigUnknown}>🎟️</span>
        </div>
      )}
    </GameCard>
  );
}
