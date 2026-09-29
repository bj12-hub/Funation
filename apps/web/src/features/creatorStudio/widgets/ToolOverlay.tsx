"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";
import type { OverlayTool } from "@/services/creator/broadcastToolTypes";
import styles from "./toolOverlay.module.css";
import { clock, timerSeconds } from "./timerMath";

const SPEED_SEC = { SLOW: 30, NORMAL: 18, FAST: 10 } as const;

/**
 * OBS overlay for 방송 도구 (code-first). Transparent page that re-reads the tool state every
 * 2 seconds; the timer ticks locally from the server's start time (corrected for clock skew).
 */
export function ToolOverlay({ data }: { data: OverlayTool }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const serverNow = data.tool === "timer" ? data.serverNow : null;
  const [skew, setSkew] = useState(0);

  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    const poll = setInterval(() => router.refresh(), 2000);
    return () => {
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);

  useEffect(() => {
    if (!serverNow) return;
    setSkew(new Date(serverNow).getTime() - Date.now());
  }, [serverNow]);

  useEffect(() => {
    if (data.tool !== "timer") return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [data.tool]);

  switch (data.tool) {
    case "subtitle":
      if (!data.state.text) return null;
      return (
        <p className={styles.subtitle} data-size={data.state.size}>
          {data.state.text}
        </p>
      );
    case "marquee": {
      if (!data.state.lines.length) return null;
      const text = data.state.lines.join("   ✦   ");
      return (
        <div className={styles.marquee}>
          <span key={text} style={{ animationDuration: `${SPEED_SEC[data.state.speed]}s` }}>
            {text}
          </span>
        </div>
      );
    }
    case "timer":
      // Rendered only after mount so the server and client markup match.
      if (now === null) return null;
      return <p className={styles.timer}>{clock(timerSeconds(data.state, now, skew))}</p>;
    case "credits":
      return (
        <div className={styles.credits}>
          <div className={styles.creditsRoll}>
            <h1>{data.state.title}</h1>
            {data.crew.length > 0 && (
              <ol>
                {data.crew.map((c) => (
                  <li key={c.name}>
                    <span>{c.name}</span>
                    <span>{formatNumber(c.score)} FN</span>
                  </li>
                ))}
              </ol>
            )}
            {data.state.thanks.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </div>
      );
  }
}
