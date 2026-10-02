"use client";

import { useEffect, useState } from "react";
import { ROLE_LABEL, type ChatOverlayLine } from "@/services/broadcast/chatTypes";
import { getChatOverlay } from "@/services/broadcast/unifiedChat";
import { getOverlayReloadSeq } from "@/services/creator/alertRemote";
import { useReloadSignal } from "../creatorStudio/remote/useReloadSignal";
import styles from "./chatOverlay.module.css";
import { PlatformMark } from "./PlatformMark";

const POLL_MS = 1_000;
const SHOWN = 12;

/**
 * 통합 채팅 OBS overlay (code-first). Transparent page that re-reads the merged feed every second and shows
 * the latest visible lines from every platform with the platform mark. Lines hidden in the studio
 * disappear on the next read; 리모컨 기능별 새로고침 reloads it. Push transport instead of polling is TBD.
 */
export function ChatOverlay({ overlayKey, initial, initialReloadSeq }: { overlayKey: string; initial: ChatOverlayLine[]; initialReloadSeq: number }) {
  const [lines, setLines] = useState(initial);
  const [reloadSeq, setReloadSeq] = useState(initialReloadSeq);
  useReloadSignal(reloadSeq);

  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    let alive = true;
    const poll = setInterval(async () => {
      const next = await getChatOverlay(overlayKey).catch(() => null);
      if (alive && next && next !== "FORBIDDEN") setLines(next);
      const seq = await getOverlayReloadSeq(overlayKey, "chat").catch(() => null);
      if (alive && typeof seq === "number") setReloadSeq(seq);
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [overlayKey]);

  return (
    <ol className={styles.stage} aria-live="polite" aria-label="통합 채팅">
      {lines.slice(-SHOWN).map((l) => (
        <li key={l.id} className={styles.line}>
          <PlatformMark platform={l.platform} />
          <span className={styles.name}>{l.name}</span>
          {l.roles
            .filter((r) => r !== "MEMBER")
            .map((r) => (
              <span key={r} className={styles.role}>
                {ROLE_LABEL[r]}
              </span>
            ))}
          <span className={styles.text}>{l.text}</span>
        </li>
      ))}
    </ol>
  );
}
