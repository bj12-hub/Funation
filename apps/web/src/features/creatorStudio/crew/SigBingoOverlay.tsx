"use client";

import type { CSSProperties } from "react";
import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { formatNumber } from "@/lib/format";
import { useServerClock } from "@/hooks/useServerClock";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { SIG_BINGO_TITLE_DEFAULT, sigBingoLines, type SigBingoBoard, type SigBingoGrid, type SigBingoLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/** Boards side by side: up to 4 columns (BJ(개인) with more members wraps). */
export const bingoColumns = (boards: number) => (boards <= 4 ? boards : Math.min(4, Math.ceil(boards / 2)));

function BingoGrid({ board, grid }: { board: SigBingoBoard; grid: SigBingoGrid }) {
  const inLine = new Set(grid.lines.flatMap((l) => sigBingoLines(board.size)[l]));
  return (
    <ol className={styles.bingoGrid} style={{ "--bingo-size": board.size } as CSSProperties} aria-hidden="true">
      {grid.cells.map((c, i) => (
        <li
          key={i}
          className={styles.bingoCell}
          data-open={c.opened ? "" : undefined}
          data-line={inLine.has(i) || undefined}
          data-last={grid.lastOpened === i || undefined}
          style={c.opened?.memberColor ? ({ "--cell-color": c.opened.memberColor } as CSSProperties) : undefined}
        >
          {!c.opened && board.reveal === "HIDDEN" ? (
            <span className={`${ov.display} ${styles.bingoQ}`}>?</span>
          ) : c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
            <img src={c.imageUrl} alt="" />
          ) : (
            <span className={styles.bingoName}>{c.signatureName}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * 시그 빙고 overlay (`?sigbingo`): the board — closed cells show their signature dimmed (칸 공개) or "?" (칸 숨김), opened
 * ones in full (땅따먹기: framed in the member's color), cells of 빙고 lines glow and the last opened one pops — and each
 * 빙고 line as it plays, with the 남은 시그 under the board when chosen (2026-10-25). BJ(팀) · BJ(개인) (2026-10-28): the
 * boards side by side, each under its team or member (color) with its 빙고 count. Without a board it waits (대기 중에도
 * 보이기), or the page stays empty.
 */
export function SigBingoOverlay({ sigBingo, serverNow, reloadSeq, theme }: { sigBingo: SigBingoLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!sigBingo || now === null) return null;
  const board = sigBingo.board;
  const run = currentRun(sigBingo.runs, "SIG_BINGO", now);
  if (!board && !run && !sigBingo.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const grids = board?.grids ?? [];
  const multi = grids.length > 1 || grids.some((g) => g.label);
  const cells = grids.flatMap((g) => g.cells);
  const lines = grids.reduce((s, g) => s + g.lines.length, 0);
  return (
    <GameCard
      theme={theme}
      title={sigBingo.settings.title || SIG_BINGO_TITLE_DEFAULT}
      waiting={sigBingo.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run?.points ? signedPoints(run.points) : "" }}
      idle={!board ? "빙고 시작 전이에요" : multi ? `판 ${grids.length}개 · 빙고 ${lines}줄` : `열린 칸 ${cells.filter((c) => c.opened).length}/${cells.length} · 빙고 ${lines}줄`}
      playing="빙고!"
      wide
      columns={multi ? bingoColumns(grids.length) : undefined}
    >
      {board && multi ? (
        <div className={styles.bingoBoards} style={{ "--bingo-cols": bingoColumns(grids.length) } as CSSProperties}>
          {grids.map((g) => (
            <section key={g.key} className={styles.bingoBoard}>
              <h2 className={`${ov.label} ${styles.bingoBoardName}`}>
                {g.color && <i style={{ background: g.color }} aria-hidden="true" />}
                {g.label}
                <span className={ov.muted}>빙고 {g.lines.length}줄</span>
              </h2>
              <BingoGrid board={board} grid={g} />
            </section>
          ))}
        </div>
      ) : board && grids[0] ? (
        <BingoGrid board={board} grid={grids[0]} />
      ) : (
        <div className={styles.sigStage}>
          <span className={styles.sigUnknown}>🎯</span>
        </div>
      )}
      {board && sigBingo.settings.showRemaining && sigBingo.remaining.length > 0 && (
        <ul className={styles.bingoLeft} aria-label="남은 시그">
          {sigBingo.remaining.map((r) => (
            <li key={r.signatureId}>
              {r.name} {formatNumber(r.price)}
              {r.cells > 1 && ` ×${r.cells}`}
            </li>
          ))}
        </ul>
      )}
    </GameCard>
  );
}
