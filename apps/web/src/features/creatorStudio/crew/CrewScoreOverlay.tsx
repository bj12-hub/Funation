"use client";

import { useRouter } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { OVERLAY_BOARD_ROWS, type Battle, type OverlayScenario, type OverlayScoreboard, type StealRecord, type SubBoard } from "@/services/crew/crewTypes";
import { penaltyText, resultText, useCountdown } from "./BattlePanel";
import { partName, usePartElapsed } from "./ScenarioPanel";
import { stealText } from "./StealPanel";
import { useReloadSignal } from "../remote/useReloadSignal";
import styles from "./overlay.module.css";

/**
 * OBS overlay (code-first). Transparent page that re-reads the live scoreboard from the server every
 * 3 seconds. Shows nothing while no broadcast is running. Every crew view draws in the 크루 점수판 오버레이 테마
 * (2026-10-08), chosen on the 방송 운영 screen.
 */
export function CrewScoreOverlay({ data, reloadSeq, theme }: { data: OverlayScoreboard | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);

  if (!data) return null;
  return <MainBoard data={data} theme={theme} />;
}

/** Transparent page + 3-second server refresh + 기능별 새로고침, shared by every crew overlay. */
function useOverlayPage(reloadSeq: number) {
  const router = useRouter();
  useReloadSignal(reloadSeq);
  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    const poll = setInterval(() => router.refresh(), 3000);
    return () => {
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);
}

/** Member rows: rank badge (1 · 2 · 3 medals), name, a bar in the member's color, score. */
function Rows({ rows }: { rows: { memberId: string; name: string; score: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(0, r.score)));
  return (
    <ol className={styles.rows}>
      {rows.slice(0, OVERLAY_BOARD_ROWS).map((r, i) => (
        <li key={r.memberId} data-rank={i < 3 ? i + 1 : undefined}>
          <span className={`${ov.display} ${styles.rank}`}>{i + 1}</span>
          <span className={`${ov.label} ${styles.name}`}>{r.name}</span>
          <span className={`${ov.track} ${styles.bar}`}>
            <span className={ov.fill} style={{ width: `${(Math.max(0, r.score) / max) * 100}%`, "--ov-accent": r.color } as CSSProperties} />
          </span>
          <span className={`${ov.display} ${styles.score}`}>{formatNumber(r.score)}</span>
        </li>
      ))}
    </ol>
  );
}

function MainBoard({ data, theme }: { data: OverlayScoreboard; theme: ResolvedTheme }) {
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.board}`}>
        <h1 className={`${ov.label} ${styles.title}`}>{data.title}</h1>
        {data.oneshotPot !== null && <p className={`${ov.chip} ${ov.chipAccent} ${styles.banner}`}>한방 모으는 중 · {formatNumber(data.oneshotPot)}점</p>}
        {data.showRankUp && data.rankUp && (
          <p className={`${ov.chip} ${styles.banner}`}>
            🔥 랭크업 · {data.rankUp.lower.name} → {data.rankUp.upper.name} {data.rankUp.gap === 0 ? "동점!" : `${formatNumber(data.rankUp.gap)}점 차`}
          </p>
        )}
        {data.teamMode && (
          <div className={styles.teams}>
            {data.teams.map((t) => (
              <span key={t.key} data-team={t.key} className={ov.label}>
                {t.key}팀 <b className={ov.display}>{formatNumber(t.score)}</b>
              </span>
            ))}
          </div>
        )}
        <Rows rows={data.rows} />
      </div>
    </OverlayThemeRoot>
  );
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** 실시간 배틀 overlay (`?battle`): the running battle (or the last result) with its timer, as a tug of war. */
export function BattleOverlay({ battle: x, reloadSeq, theme }: { battle: Battle | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const left = useCountdown(x ?? undefined);
  if (!x) return null;
  const [a, b] = x.sides;
  const total = Math.max(0, a.score) + Math.max(0, b.score);
  const share = total ? (Math.max(0, a.score) / total) * 100 : 50;
  const penalty = penaltyText(x);
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.battle}`}>
        <div className={styles.battleHead}>
          <span className={`${ov.chip} ${ov.chipAccent}`}>
            {x.title}
            {x.multiplier !== 1 && ` ×${x.multiplier}`}
          </span>
          {x.running ? <span className={`${ov.chip} ${ov.display} ${styles.timer}`}>{mmss(left)}</span> : <span className={ov.chip}>{resultText(x)}</span>}
        </div>
        <div className={styles.sides}>
          {x.sides.map((s) => (
            <span key={s.key} className={styles.side} data-win={!x.running && x.leader === s.key ? "" : undefined}>
              <span className={ov.label}>
                <i className={styles.dot} style={{ background: s.color }} aria-hidden="true" /> {s.label}
              </span>
              <strong className={`${ov.display} ${styles.sideScore}`}>{formatNumber(s.score)}</strong>
            </span>
          ))}
        </div>
        <span className={`${ov.track} ${styles.tug}`} role="img" aria-label={`${a.label} ${Math.round(share)}% · ${b.label} ${100 - Math.round(share)}%`}>
          <span style={{ width: `${share}%`, background: a.color }} />
          <span style={{ width: `${100 - share}%`, background: b.color }} />
        </span>
        {x.running && <span className={ov.muted}>{resultText(x)}</span>}
        {penalty && <p className={`${ov.chip} ${styles.penalty}`}>{penalty}</p>}
      </div>
    </OverlayThemeRoot>
  );
}

/** 콘텐츠 시나리오 overlay (`?scenario`): the running part, its time and what comes next. */
export function ScenarioOverlay({ scenario, serverNow, reloadSeq, theme }: { scenario: OverlayScenario | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const elapsed = usePartElapsed(scenario, serverNow);
  if (!scenario || scenario.current === null) return null;
  const i = scenario.current;
  const part = scenario.parts[i];
  const next = scenario.parts[i + 1];
  const over = elapsed !== null && !!part.minutes && elapsed > part.minutes * 60;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${theme.theme === "BOLD" ? ov.accentCard : ov.card} ${ov.pill} ${styles.scenario}`}>
        <span className={`${ov.chip} ${styles.partNo}`}>{i + 1}부</span>
        <strong className={ov.label}>{part.title || partName(i, part)}</strong>
        {elapsed !== null && (
          <span className={`${ov.display} ${styles.elapsed}`} data-over={over || undefined}>
            {mmss(elapsed)}
            {part.minutes ? <small> / {part.minutes}분</small> : null}
          </span>
        )}
        {next && <span className={`${ov.muted} ${styles.next}`}>다음 · {partName(i + 1, next)}</span>}
      </div>
    </OverlayThemeRoot>
  );
}

const STEAL_SHOW_MS = 15_000;

/**
 * 기여도 강탈 overlay (`?steal`): the latest spin for 15 seconds, then nothing until the next one. Timed on the server
 * clock (`at` is server time; the OBS PC's clock may be off).
 */
export function StealOverlay({ latest, serverNow, reloadSeq, theme }: { latest: StealRecord | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!latest || now === null || now - new Date(latest.at).getTime() > STEAL_SHOW_MS) return null;
  const hit = latest.points > 0;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div key={latest.id} className={`${ov.enter} ${ov.card} ${styles.steal}`} data-motion="ZOOM" role="status">
        <span className={`${ov.chip} ${ov.chipAccent}`}>기여도 강탈 · {latest.slotLabel}</span>
        <strong className={`${ov.display} ${styles.stealMain} ${hit ? "" : styles.stealBlank}`}>
          {hit ? `${latest.thiefName} ← ${latest.targetName} ${formatNumber(latest.points)}점` : "꽝!"}
        </strong>
        <span className={ov.muted}>{stealText(latest)}</span>
      </div>
    </OverlayThemeRoot>
  );
}

/** 서브 점수판 overlay (`?board=번호`): same polling and transparency as the main board. */
export function SubBoardOverlay({ board, reloadSeq, theme }: { board: SubBoard | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  if (!board) return null;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.board}`}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {board.title}
          {board.closedAt && <span className={`${ov.chip} ${styles.closed}`}>마감</span>}
        </h1>
        <Rows rows={board.rows} />
      </div>
    </OverlayThemeRoot>
  );
}
