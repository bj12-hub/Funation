"use client";

import { useEffect, useState } from "react";

/** 시청자 참여 게임 OBS overlays (마블 룰렛 · 로얄 럼블): entrant colors and the frame clock. */

export const PLAY_COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#84cc16", "#06b6d4"];
/** 로얄 럼블 (조작형): a distinct color per fighter, by the color number the server gives each player (up to 16). */
export const LIVE_COLORS = [...PLAY_COLORS, "#a855f7", "#f59e0b", "#10b981", "#6366f1", "#ef4444", "#0ea5e9"];
/** A stable number per entrant (its color, lane and motion). */
export const playHash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** The browser clock corrected to the server's, read every frame while `running` (every second otherwise). */
export function useFrameClock(serverNow: string, running: boolean) {
  const [skew] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    if (!running) {
      setNow(Date.now() + skew);
      const tick = setInterval(() => setNow(Date.now() + skew), 1000);
      return () => clearInterval(tick);
    }
    let frame = requestAnimationFrame(function step() {
      setNow(Date.now() + skew);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, skew]);
  return now;
}
