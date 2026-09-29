"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { formatNumber } from "@/lib/format";
import type { OverlayAlert } from "@/services/creator/alertTypes";
import styles from "./alertOverlay.module.css";

/**
 * OBS alert overlay (code-first). Transparent page that re-reads the server queue every second and
 * shows the alert the server has on screen. Reads the message aloud with the browser's speech
 * synthesis when TTS volume > 0 and not muted (voices/sounds TBD).
 */
export function AlertOverlay({ data }: { data: OverlayAlert }) {
  const router = useRouter();
  const spoken = useRef<string | null>(null);

  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    const poll = setInterval(() => router.refresh(), 1000);
    return () => {
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);

  const { alert, controls } = data;
  useEffect(() => {
    if (!alert || spoken.current === alert.id) return;
    spoken.current = alert.id;
    if (controls.muted || controls.ttsVolume === 0 || !alert.message || typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(alert.message);
    u.lang = "ko-KR";
    u.volume = controls.ttsVolume / 100;
    speechSynthesis.speak(u);
  }, [alert, controls.muted, controls.ttsVolume]);

  if (!alert) return null;
  return (
    <div className={styles.stage}>
      <div key={alert.id} className={styles.card} role="status">
        <p className={styles.headline}>
          <strong>{alert.donor}</strong>님이 <strong className={styles.amount}>{formatNumber(alert.fnAmount)} FN</strong> 후원!
        </p>
        {alert.message && <p className={styles.message}>{alert.message}</p>}
        <p className={styles.type}>{alert.typeLabel}</p>
      </div>
    </div>
  );
}
