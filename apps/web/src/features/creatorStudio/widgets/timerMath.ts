import type { TimerState } from "@/services/creator/broadcastToolTypes";

/** Seconds to display for a timer at `nowMs` (display only; the server owns the state). */
export function timerSeconds(t: TimerState, nowMs: number, skewMs = 0) {
  const running = t.startedAt ? Math.max(0, Math.floor((nowMs + skewMs - new Date(t.startedAt).getTime()) / 1000)) : 0;
  const elapsed = t.elapsedBeforeSec + running;
  return t.mode === "COUNTDOWN" ? Math.max(0, t.durationSec - elapsed) : elapsed;
}

export const clock = (s: number) =>
  `${s >= 3600 ? `${String(Math.floor(s / 3600)).padStart(2, "0")}:` : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
