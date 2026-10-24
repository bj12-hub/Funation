"use client";

import type { CSSProperties } from "react";
import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { TERRITORY_TITLE_DEFAULT, type TerritoryLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import board from "./overlay.module.css";
import styles from "./gameOverlay.module.css";

/**
 * 땅따먹기 overlay (`?territory`): the board with its coordinates (A ~ · 1 ~) — each cell in its owner's color once that
 * assignment's result shows (runs queue, so a cell taken twice shows its owners in turn), the last one popping — and the
 * 점유 순위 (cells, share, 하트). Without a board it waits (대기 중에도 보이기), or the page stays empty.
 */
export function TerritoryOverlay({ territory, serverNow, reloadSeq, theme }: { territory: TerritoryLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!territory || now === null) return null;
  const terr = territory.board;
  const run = currentRun(territory.runs, "TERRITORY", now);
  if (!terr && !run && !territory.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const owners = terr ? terr.cells.map((c) => c.owners.filter((o) => now >= Date.parse(o.revealAt)).at(-1)?.memberId ?? null) : [];
  const member = (id: string | null) => territory.members.find((m) => m.memberId === id);
  const ranking = territory.members
    .map((m) => ({ ...m, cells: owners.filter((o) => o === m.memberId).length }))
    .filter((m) => m.cells > 0 || m.hearts > 0)
    .sort((x, y) => y.cells - x.cells || y.hearts - x.hearts);
  const last = terr && terr.lastCell !== null ? terr.cells[terr.lastCell].owners.at(-1) : undefined;
  const lastShown = !!last && now >= Date.parse(last.revealAt);
  return (
    <GameCard
      theme={theme}
      title={territory.settings.title || TERRITORY_TITLE_DEFAULT}
      waiting={territory.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: [run?.points ? signedPoints(run.points) : "", ...(run?.shares ?? []).map((x) => `${x.memberName} ${signedPoints(x.points)}`)].filter(Boolean).join(" · ") }}
      idle={terr ? `점령 ${owners.filter(Boolean).length}/${owners.length}칸` : "판 시작 전이에요"}
      playing="점령 중…"
      wide
    >
      {terr ? (
        <div className={styles.terr} style={{ "--terr-size": terr.size } as CSSProperties} aria-hidden="true">
          <span />
          {Array.from({ length: terr.size }, (_, c) => (
            <span key={`c${c}`} className={styles.terrAxis}>
              {String.fromCharCode(65 + c)}
            </span>
          ))}
          {Array.from({ length: terr.size }, (_, r) => (
            <div key={`r${r}`} className={styles.terrRow}>
              <span className={styles.terrAxis}>{r + 1}</span>
              {Array.from({ length: terr.size }, (_, c) => {
                const i = r * terr.size + c;
                const o = member(owners[i]);
                return (
                  <span
                    key={i}
                    className={styles.terrCell}
                    data-owned={owners[i] ? "" : undefined}
                    data-last={(lastShown && terr.lastCell === i) || undefined}
                    style={o?.color ? ({ "--cell-color": o.color } as CSSProperties) : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.sigStage}>
          <span className={styles.sigUnknown}>🗺️</span>
        </div>
      )}
      {ranking.length > 0 && terr && (
        <ol className={styles.gsRanking}>
          {ranking.map((m, i) => (
            <li key={m.memberId}>
              <span className={ov.muted}>{i + 1}</span>
              <span className={styles.gsName}>
                {m.color && <i className={board.dot} style={{ background: m.color }} aria-hidden="true" />}
                {m.name}
              </span>
              <span className={ov.muted}>♥ {m.hearts}</span>
              <strong>
                {m.cells}칸 <span className={ov.muted}>{Math.round((m.cells / owners.length) * 100)}%</span>
              </strong>
            </li>
          ))}
        </ol>
      )}
    </GameCard>
  );
}
