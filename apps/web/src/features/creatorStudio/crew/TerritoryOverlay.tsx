"use client";

import type { CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { formatNumber } from "@/lib/format";
import { useServerClock } from "@/hooks/useServerClock";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { TERRITORY_TITLE_DEFAULT, type TerritoryLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import board from "./overlay.module.css";
import styles from "./gameOverlay.module.css";

/** Who owns each cell as OBS shows it at `now`, and the 점유 순위 from it (cells, then 하트). */
export function territoryRanking(territory: TerritoryLive, now: number) {
  const terr = territory.board;
  const owners = terr ? terr.cells.map((c) => c.owners.filter((o) => now >= Date.parse(o.revealAt)).at(-1)?.memberId ?? null) : [];
  const ranking = territory.members
    .map((m) => ({ ...m, cells: owners.filter((o) => o === m.memberId).length }))
    .filter((m) => m.cells > 0 || m.hearts > 0)
    .sort((x, y) => y.cells - x.cells || y.hearts - x.hearts);
  return { owners, ranking };
}

/**
 * 땅따먹기 overlay (`?territory`): the board with its coordinates (A ~ · 1 ~) — each cell in its owner's color once that
 * assignment's result shows (runs queue, so a cell taken twice shows its owners in turn), the last one popping — and the
 * 점유 순위 (cells, share, 하트), and with 점유 롤링 표시 (2026-10-28) a line of 멤버 · 칸 (· 점수 with a 칸 점수) scrolling
 * above or below the board. Colors are the 땅따먹기 BJ 색상. Without a board it waits (대기 중에도 보이기), or the page stays
 * empty.
 */
export function TerritoryOverlay({ territory, serverNow, reloadSeq, theme }: { territory: TerritoryLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!territory || now === null) return null;
  const terr = territory.board;
  const run = currentRun(territory.runs, "TERRITORY", now);
  if (!terr && !run && !territory.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const { owners, ranking } = territoryRanking(territory, now);
  const member = (id: string | null) => territory.members.find((m) => m.memberId === id);
  const cellPoints = territory.settings.cellPoints;
  const ticker = terr && territory.settings.ticker !== "OFF" && (
    <p className={`${ov.label} ${styles.terrTicker}`} aria-hidden="true">
      <span style={{ animationDuration: `${Math.max(10, ranking.length * 5)}s` }}>
        {ranking.some((m) => m.cells > 0)
          ? ranking
              .filter((m) => m.cells > 0)
              .map((m) => (
                <b key={m.memberId}>
                  {m.color && <i style={{ background: m.color }} />}
                  {m.name} {m.cells}칸{cellPoints > 0 && ` · ${formatNumber(m.cells * cellPoints)}점`}
                </b>
              ))
          : "아직 점령한 칸이 없어요"}
      </span>
    </p>
  );
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
      {territory.settings.ticker === "TOP" && ticker}
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
      {territory.settings.ticker === "BOTTOM" && ticker}
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

/**
 * 땅따먹기 점유 현황 (`?territoryrank`, 2026-10-28 — StreamDonate "점유 현황 (순위)" as its own source): the 점유 순위 alone —
 * each member's cells as OBS shows them now, share, 하트 (and 점수 with a 칸 점수). Without a board it waits (대기 중에도
 * 보이기), or the page stays empty.
 */
export function TerritoryRankOverlay({ territory, serverNow, reloadSeq, theme }: { territory: TerritoryLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!territory || now === null) return null;
  const terr = territory.board;
  if (!terr && !territory.settings.showIdle) return null;
  const { owners, ranking } = territoryRanking(territory, now);
  const cellPoints = territory.settings.cellPoints;
  return (
    <OverlayThemeRoot theme={theme} className={board.pad}>
      <div className={`${ov.card} ${styles.rankCard}`}>
        <h1 className={`${ov.label} ${styles.rankTitle}`}>🏆 {territory.settings.title || TERRITORY_TITLE_DEFAULT} 점유 현황</h1>
        {!terr ? (
          <p className={ov.muted}>판 시작 전이에요</p>
        ) : ranking.length === 0 ? (
          <p className={ov.muted}>아직 점령한 칸이 없어요</p>
        ) : (
          <ol className={styles.gsRanking}>
            {ranking.map((m, i) => (
              <li key={m.memberId}>
                <span className={ov.muted}>{i + 1}</span>
                <span className={styles.gsName}>
                  {m.color && <i className={board.dot} style={{ background: m.color }} aria-hidden="true" />}
                  {m.name}
                </span>
                <span className={ov.muted}>
                  ♥ {m.hearts}
                  {cellPoints > 0 && ` · ${formatNumber(m.cells * cellPoints)}점`}
                </span>
                <strong>
                  {m.cells}칸 <span className={ov.muted}>{Math.round((m.cells / owners.length) * 100)}%</span>
                </strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    </OverlayThemeRoot>
  );
}
