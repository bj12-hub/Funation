"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { Battle, BroadcastLive, ScenarioLive, StealRecord, SubBoard } from "@/services/crew/crewTypes";
import { BattleBoard, useCountdown } from "./BattlePanel";
import { partName, usePartElapsed } from "./ScenarioPanel";
import { stealText } from "./StealPanel";
import scenStyles from "./scenario.module.css";
import battleStyles from "./battle.module.css";
import stealStyles from "./steal.module.css";
import styles from "./overlay.module.css";

/**
 * OBS overlay (code-first). Transparent page that re-reads the live scoreboard from the server every
 * 3 seconds. Shows nothing while no broadcast is running.
 */
export function CrewScoreOverlay({ data }: { data: BroadcastLive | null }) {
  useOverlayPage();

  if (!data) return null;
  return <MainBoard data={data} />;
}

/** Transparent page + 3-second server refresh shared by both scoreboard overlays. */
function useOverlayPage() {
  const router = useRouter();
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

function MainBoard({ data }: { data: BroadcastLive }) {
  const max = Math.max(1, ...data.rows.map((r) => Math.max(0, r.score)));

  return (
    <div className={styles.overlay}>
      <h1 className={styles.title}>{data.title}</h1>
      {data.oneshotPot !== null && <p className={styles.oneshot}>한방 모으는 중 · {formatNumber(data.oneshotPot)}점</p>}
      {data.teamMode && (
        <div className={styles.teams}>
          {data.teams.map((t) => (
            <span key={t.key} data-team={t.key}>
              {t.key}팀 {formatNumber(t.score)}
            </span>
          ))}
        </div>
      )}
      <ol className={styles.rows}>
        {data.rows.slice(0, 10).map((r, i) => (
          <li key={r.memberId}>
            <span className={styles.rank}>{i + 1}</span>
            <span className={styles.name}>{r.name}</span>
            <span className={styles.bar}>
              <span style={{ width: `${(Math.max(0, r.score) / max) * 100}%`, background: r.color }} />
            </span>
            <span className={styles.score}>{formatNumber(r.score)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 실시간 배틀 overlay (`?battle`): the running battle (or the last result) with its timer. */
export function BattleOverlay({ battle }: { battle: Battle | null }) {
  useOverlayPage();
  const left = useCountdown(battle ?? undefined);
  if (!battle) return null;
  return (
    <div className={styles.overlay}>
      {battle.running && <span className={battleStyles.overlayTimer}>{`${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`}</span>}
      <BattleBoard battle={battle} big />
    </div>
  );
}

/** 콘텐츠 시나리오 overlay (`?scenario`): the running part, its time and what comes next. */
export function ScenarioOverlay({ scenario }: { scenario: ScenarioLive | null }) {
  useOverlayPage();
  const elapsed = usePartElapsed(scenario);
  if (!scenario || scenario.current === null) return null;
  const i = scenario.current;
  const part = scenario.parts[i];
  const next = scenario.parts[i + 1];
  const mm = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div className={styles.overlay}>
      <div className={scenStyles.overlayPart}>
        <strong>{partName(i, part)}</strong>
        {elapsed !== null && (
          <span>
            {mm(elapsed)}
            {part.minutes ? ` / ${part.minutes}분` : ""}
          </span>
        )}
        {next && <span className={scenStyles.overlayNext}>다음 · {partName(i + 1, next)}</span>}
      </div>
    </div>
  );
}

const STEAL_SHOW_MS = 15_000;

/** 기여도 강탈 overlay (`?steal`): the latest spin for 15 seconds, then nothing until the next one. */
export function StealOverlay({ latest }: { latest: StealRecord | null }) {
  useOverlayPage();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!latest || now === null || now - new Date(latest.at).getTime() > STEAL_SHOW_MS) return null;
  return (
    <div className={styles.overlay}>
      <div key={latest.id} className={stealStyles.overlayCard} role="status">
        <span>기여도 강탈 · {latest.slotLabel}</span>
        <strong>{latest.points > 0 ? `${latest.thiefName} ← ${latest.targetName} ${formatNumber(latest.points)}점` : "꽝!"}</strong>
        <span>{stealText(latest)}</span>
      </div>
    </div>
  );
}

/** 서브 점수판 overlay (`?board=번호`): same polling and transparency as the main board. */
export function SubBoardOverlay({ board }: { board: SubBoard | null }) {
  useOverlayPage();
  if (!board) return null;
  const max = Math.max(1, ...board.rows.map((r) => r.score));
  return (
    <div className={styles.overlay}>
      <h1 className={styles.title}>
        {board.title}
        {board.closedAt && <span className={styles.closed}> · 마감</span>}
      </h1>
      <ol className={styles.rows}>
        {board.rows.slice(0, 10).map((r, i) => (
          <li key={r.memberId}>
            <span className={styles.rank}>{i + 1}</span>
            <span className={styles.name}>{r.name}</span>
            <span className={styles.bar}>
              <span style={{ width: `${(r.score / max) * 100}%`, background: r.color }} />
            </span>
            <span className={styles.score}>{formatNumber(r.score)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
