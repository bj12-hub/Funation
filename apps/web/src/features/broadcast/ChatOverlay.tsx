"use client";

import { useEffect, useState } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import type { ChatOverlayView } from "@/services/broadcast/chatTypes";
import { getChatOverlay } from "@/services/broadcast/unifiedChat";
import { getOverlaySignal } from "@/services/creator/alertRemote";
import type { OverlaySignal } from "@/services/creator/alertTypes";
import { useReloadSignal } from "../creatorStudio/remote/useReloadSignal";
import { ChatLines } from "./ChatLines";
import styles from "./chatOverlay.module.css";

const POLL_MS = 1_000;

/**
 * 통합 채팅 OBS overlay (code-first). Transparent page that re-reads the merged feed every second and shows
 * the latest visible lines from every platform, drawn as the 채팅창 widget settings say (ChatLines: 위젯 스타일,
 * 오버레이 테마, 폰트, 최대 줄, 자동으로 감추기 on the server clock). Lines hidden in the studio and 필터링 닉네임
 * never arrive; 리모컨 기능 제어 can switch it OFF or reload it. Push transport instead of polling is TBD.
 */
export function ChatOverlay({ overlayKey, initial, initialSignal }: { overlayKey: string; initial: ChatOverlayView; initialSignal: OverlaySignal }) {
  const [view, setView] = useState(initial);
  const [signal, setSignal] = useState(initialSignal);
  const now = useServerClock(view.serverNow);
  useReloadSignal(signal.reloadSeq);

  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    let alive = true;
    const poll = setInterval(async () => {
      const next = await getChatOverlay(overlayKey).catch(() => null);
      if (alive && next && next !== "FORBIDDEN") setView(next);
      const next2 = await getOverlaySignal(overlayKey, "chat").catch(() => null);
      if (alive && next2 && next2 !== "FORBIDDEN") setSignal(next2);
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [overlayKey]);

  if (!signal.on) return null;
  return (
    <div className={styles.stage}>
      {/* Before the clock mounts, nothing is hidden yet (server and client render the same lines). */}
      <ChatLines lines={view.lines} settings={view.settings} theme={view.theme} now={now} />
    </div>
  );
}
