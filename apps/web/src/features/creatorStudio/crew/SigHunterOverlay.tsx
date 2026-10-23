"use client";

import type { CSSProperties } from "react";
import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { SIG_HUNTER_TITLE_DEFAULT, sigHunterColumns, type SigHunterLive, type SigHunterSlot } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, gameEffect, signedPoints } from "./GameOverlayParts";
import styles from "./gameOverlay.module.css";

/**
 * 시그니처 헌터 overlay (`?sighunter`, 판매상태): the 라운드 board — each slot's signature and price; a slot being sold pulses
 * until its run's result, then shows SOLD OUT in the buyer's color (a 몰수권 is revealed only then, a taken slot dims) and
 * the last one pops. The run's result shows below with what a 몰수권 took. Without a hunt it waits (대기 중에도 보이기).
 */
export function SigHunterOverlay({ sigHunter, serverNow, reloadSeq, theme }: { sigHunter: SigHunterLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!sigHunter || now === null) return null;
  const board = sigHunter.board;
  const run = currentRun(sigHunter.runs, "SIG_HUNTER", now);
  if (!board && !run && !sigHunter.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const soldOut = (x: SigHunterSlot) => !!x.sold && now >= Date.parse(x.sold.revealAt);
  const left = board ? board.slots.filter((x) => !soldOut(x)).length : 0;
  const sub = run ? [run.kind === "MULTIPLY" || run.kind === "ADD" ? gameEffect(run) : "", ...run.shares.map((x) => `${x.memberName} ${signedPoints(x.points)}`)].filter(Boolean).join(" · ") : "";
  return (
    <GameCard
      theme={theme}
      title={sigHunter.settings.title || SIG_HUNTER_TITLE_DEFAULT}
      waiting={sigHunter.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub }}
      idle={board ? `${board.round}라운드${board.multiplier > 1 ? ` · ×${board.multiplier}` : ""} · 남은 시그 ${left}/${board.slots.length}` : "헌트 시작 전이에요"}
      playing="SOLD OUT…"
      wide
    >
      {board ? (
        <ol className={styles.bingoGrid} style={{ "--bingo-size": sigHunterColumns(board.slots.length) } as CSSProperties} aria-hidden="true">
          {board.slots.map((x, i) => {
            const out = soldOut(x);
            return (
              <li
                key={i}
                className={`${styles.bingoCell} ${styles.hunterTile}`}
                data-open={out ? "" : undefined}
                data-opening={(!!x.sold && !out) || undefined}
                data-absorbed={(out && !!x.sold?.absorbedBy) || undefined}
                data-last={(out && board.lastSold === i) || undefined}
                style={out && x.sold?.memberColor ? ({ "--cell-color": x.sold.memberColor } as CSSProperties) : undefined}
              >
                {x.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
                  <img src={x.imageUrl} alt="" />
                ) : (
                  <span className={styles.bingoName}>{x.signatureName}</span>
                )}
                {out ? (
                  <span className={`${ov.display} ${styles.soldStamp}`}>{x.forfeit ? "몰수권" : x.sold?.absorbedBy ? "몰수" : "SOLD OUT"}</span>
                ) : (
                  <span className={styles.hunterPrice}>{formatNumber(x.price)}</span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.sigStage}>
          <span className={styles.sigUnknown}>🏹</span>
        </div>
      )}
    </GameCard>
  );
}
