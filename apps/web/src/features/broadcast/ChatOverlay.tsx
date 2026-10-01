"use client";

import { useEffect, useState } from "react";
import { ROLE_LABEL, type ChatOverlayLine } from "@/services/broadcast/chatTypes";
import { getChatOverlay } from "@/services/broadcast/unifiedChat";
import styles from "./chatOverlay.module.css";
import { PlatformMark } from "./PlatformMark";

const POLL_MS = 1_000;
const SHOWN = 12;

/**
 * 통합 채팅 OBS overlay (code-first). Transparent page that re-reads the merged feed every second and shows
 * the latest visible lines from every platform with the platform mark. Lines hidden in the studio
 * disappear on the next read. Push transport instead of polling is TBD.
 */
export function ChatOverlay({ overlayKey, initial }: { overlayKey: string; initial: ChatOverlayLine[] }) {
  const [lines, setLines] = useState(initial);

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
