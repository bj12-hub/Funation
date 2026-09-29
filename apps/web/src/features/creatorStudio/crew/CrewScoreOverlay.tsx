"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatNumber } from "@/lib/format";
import type { BroadcastLive, SubBoard } from "@/services/crew/crewTypes";
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
      {data.oneshotPot !== null && <p className={styles.oneshot}>한방 모으는 중 · {formatNumber(data.oneshotPot)} FN</p>}
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
