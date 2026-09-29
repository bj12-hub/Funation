"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { formatNumber } from "@/lib/format";
import type { BroadcastLive } from "@/services/crew/crewTypes";
import styles from "./overlay.module.css";

/**
 * OBS overlay (code-first). Transparent page that re-reads the live scoreboard from the server every
 * 3 seconds. Shows nothing while no broadcast is running.
 */
export function CrewScoreOverlay({ data }: { data: BroadcastLive | null }) {
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

  if (!data) return null;
  const max = Math.max(1, ...data.rows.map((r) => Math.max(0, r.score)));

  return (
    <div className={styles.overlay}>
      <h1 className={styles.title}>{data.title}</h1>
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
