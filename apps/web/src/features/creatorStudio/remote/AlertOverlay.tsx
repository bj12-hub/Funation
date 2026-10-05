"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { PlatformMark } from "@/features/broadcast/PlatformMark";
import { alertAmount, type OverlayAlert } from "@/services/creator/alertTypes";
import styles from "./alertOverlay.module.css";
import { useReloadSignal } from "./useReloadSignal";

/**
 * OBS alert overlay (code-first). Transparent page that re-reads the server queue every second and
 * shows the alert the server has on screen. Reads the message aloud with the browser's speech
 * synthesis when TTS volume > 0 and not muted (voices TBD), and plays a 시그니처's sound at 시그니처 볼륨.
 */
export function AlertOverlay({ data }: { data: OverlayAlert }) {
  const router = useRouter();
  const spoken = useRef<string | null>(null);
  const played = useRef<string | null>(null);
  const sound = useRef<HTMLAudioElement | null>(null);

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
  useReloadSignal(data.reloadSeq);

  // TTS 스킵 from the remote: stop speaking (the card stays until its time is up).
  const skipSeq = useRef(data.ttsSkipSeq);
  useEffect(() => {
    if (data.ttsSkipSeq === skipSeq.current) return;
    skipSeq.current = data.ttsSkipSeq;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }, [data.ttsSkipSeq]);

  useEffect(() => {
    if (!alert || spoken.current === alert.id) return;
    spoken.current = alert.id;
    if (!data.on || controls.muted || controls.ttsVolume === 0 || !alert.message || typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(alert.message);
    u.lang = "ko-KR";
    u.volume = controls.ttsVolume / 100;
    speechSynthesis.speak(u);
  }, [alert, controls.muted, controls.ttsVolume, data.on]);

  // 시그니처 소리: played once per alert at 시그니처 볼륨.
  useEffect(() => {
    if (!alert?.soundUrl || played.current === alert.id) return;
    played.current = alert.id;
    if (!data.on || controls.muted || controls.signatureVolume === 0) return;
    sound.current?.pause();
    sound.current = new Audio(alert.soundUrl);
    sound.current.volume = controls.signatureVolume / 100;
    sound.current.play().catch(() => {}); // OBS allows autoplay; a normal browser tab may block it
  }, [alert, controls.muted, controls.signatureVolume, data.on]);

  // The playing sound follows the remote: a new volume applies at once; mute, OFF or the alert leaving stops it.
  const alertId = alert?.id ?? null;
  useEffect(() => {
    const s = sound.current;
    if (!s) return;
    if (alertId !== played.current || !data.on || controls.muted) {
      s.pause();
      sound.current = null;
    } else s.volume = controls.signatureVolume / 100;
  }, [alertId, controls.muted, controls.signatureVolume, data.on]);
  useEffect(() => () => sound.current?.pause(), []);

  // 리모컨 기능 제어 OFF: nothing on screen and no TTS.
  if (!alert || !data.on) return null;
  return (
    <div className={styles.stage}>
      <div key={alert.id} className={styles.card} role="status">
        {alert.badges && alert.badges.length > 0 && (
          <span className={styles.badges}>
            {alert.badges.map((b) => (
              <span key={b} className={styles.badge}>
                {b}
              </span>
            ))}
          </span>
        )}
        <p className={styles.headline}>
          <strong>{alert.donor}</strong>님이 <strong className={styles.amount}>{alertAmount(alert)}</strong> 후원!
        </p>
        {alert.message && <p className={styles.message}>{alert.message}</p>}
        <p className={styles.type}>
          {alert.platform && <PlatformMark platform={alert.platform} size="sm" />} {alert.typeLabel}
        </p>
      </div>
    </div>
  );
}
