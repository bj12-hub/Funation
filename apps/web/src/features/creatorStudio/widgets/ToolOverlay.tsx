"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";
import { bingoLines, type OverlayTool } from "@/services/creator/broadcastToolTypes";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import styles from "./toolOverlay.module.css";
import { useReloadSignal } from "../remote/useReloadSignal";
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
  useReloadSignal(data.reloadSeq);

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

  // 리모컨 기능 제어 OFF: show nothing.
  if (!data.on) return null;
  return <ToolView data={data} now={now} skew={skew} />;
}

/**
 * The 방송 도구 overlays in the 방송 도구 테마 (2026-10-08 오버레이 테마): 자막 · 전광판 as theme pills, 타이머 in display
 * numbers, 엔딩 크레딧 rolling on the stream with the crew ranking in a card, 빙고 cards with stamped marks.
 */
function ToolView({ data, now, skew }: { data: OverlayTool; now: number | null; skew: number }) {
  switch (data.tool) {
    case "subtitle":
      if (!data.state.text) return null;
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <p key={data.state.text} className={`${ov.enter} ${data.theme.theme === "BOLD" ? ov.accentCard : ov.card} ${styles.subtitle}`} data-motion="SLIDE_UP" data-size={data.state.size}>
            {data.state.text}
          </p>
        </OverlayThemeRoot>
      );
    case "marquee": {
      if (!data.state.lines.length) return null;
      const text = data.state.lines.join("   ✦   ");
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <div className={`${data.theme.theme === "BOLD" ? ov.accentCard : ov.card} ${ov.pill} ${styles.marquee}`}>
            <span className={`${ov.chip} ${ov.chipAccent} ${styles.marqueeTag}`}>공지</span>
            <div className={styles.marqueeTrack}>
              <span key={text} style={{ animationDuration: `${SPEED_SEC[data.state.speed]}s` }}>
                {text}
              </span>
            </div>
          </div>
        </OverlayThemeRoot>
      );
    }
    case "timer":
      // Rendered only after mount so the server and client markup match.
      if (now === null) return null;
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <p className={`${data.theme.theme === "BOLD" ? ov.accentCard : ov.card} ${ov.display} ${styles.timer}`}>{clock(timerSeconds(data.state, now, skew))}</p>
        </OverlayThemeRoot>
      );
    case "credits":
      // Shown only while rolling (리모컨 / 방송 도구 "시작"); a new start restarts from the top.
      if (!data.state.rollingSince) return null;
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.credits}>
          <div key={data.state.rollingSince} className={`${ov.onStream} ${styles.creditsRoll}`}>
            <h1 className={ov.display}>{data.state.title}</h1>
            {data.crew.length > 0 && (
              <ol className={`${ov.card} ${styles.creditsCrew}`}>
                {data.crew.map((c, i) => (
                  <li key={c.name}>
                    <span className={`${ov.chip} ${i === 0 ? ov.chipAccent : ""}`}>{i + 1}</span>
                    <span className={ov.label}>{c.name}</span>
                    <span className={ov.display}>{formatNumber(c.score)} FN</span>
                  </li>
                ))}
              </ol>
            )}
            {data.state.thanks.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </OverlayThemeRoot>
      );
    case "bingo": {
      // Shown only while 화면에 보이기 is on (방송 도구 빙고 card).
      if (!data.state.shown) return null;
      const { title, size, cells, marked, goal } = data.state;
      const lines = bingoLines(size, marked);
      const done = lines >= goal;
      return (
        <OverlayThemeRoot theme={data.theme} className={styles.pad}>
          <div className={`${ov.card} ${styles.bingo}`}>
            {title && <h1 className={ov.label}>{title}</h1>}
            <div className={styles.bingoBoard} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
              {cells.map((c, i) => (
                <span key={i} data-marked={marked[i] || undefined}>
                  {c}
                </span>
              ))}
            </div>
            <p key={String(done)} className={`${ov.enter} ${done ? `${ov.chip} ${ov.chipAccent}` : ov.chip} ${styles.bingoStatus}`} data-motion={done ? "ZOOM" : "NONE"} data-done={done || undefined}>
              {done ? `빙고! ${lines}줄 완성` : `${lines}줄 완성 · 목표 ${goal}줄`}
            </p>
          </div>
        </OverlayThemeRoot>
      );
    }
  }
}
