"use client";

import type { CSSProperties } from "react";
import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { formatNumber } from "@/lib/format";
import { useServerClock } from "@/hooks/useServerClock";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { SIG_BINGO_TITLE_DEFAULT, sigBingoLines, type SigBingoLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/**
 * 시그 빙고 overlay (`?sigbingo`): the board — closed cells show their signature dimmed (칸 공개) or "?" (칸 숨김), opened
 * ones in full (땅따먹기: framed in the member's color), cells of 빙고 lines glow and the last opened one pops — and each
 * 빙고 line as it plays, with the 남은 시그 under the board when chosen (2026-10-25). Without a board it waits (대기 중에도
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
  const inLine = new Set(board ? board.lines.flatMap((l) => sigBingoLines(board.size)[l]) : []);
  return (
    <GameCard
      theme={theme}
      title={sigBingo.settings.title || SIG_BINGO_TITLE_DEFAULT}
      waiting={sigBingo.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run?.points ? signedPoints(run.points) : "" }}
      idle={board ? `열린 칸 ${board.cells.filter((c) => c.opened).length}/${board.cells.length} · 빙고 ${board.lines.length}줄` : "빙고 시작 전이에요"}
      playing="빙고!"
      wide
    >
      {board ? (
        <ol className={styles.bingoGrid} style={{ "--bingo-size": board.size } as CSSProperties} aria-hidden="true">
          {board.cells.map((c, i) => (
            <li
              key={i}
              className={styles.bingoCell}
              data-open={c.opened ? "" : undefined}
              data-line={inLine.has(i) || undefined}
              data-last={board.lastOpened === i || undefined}
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
