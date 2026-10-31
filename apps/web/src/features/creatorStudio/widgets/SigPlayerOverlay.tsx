"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import type { OverlaySigPlayer } from "@/services/creator/sigPlayerTypes";
import { useReloadSignal } from "../remote/useReloadSignal";
import styles from "./sigPlayerOverlay.module.css";
import type { SigFetchMode } from "@/services/creator/widgetSettingsTypes";
import { useSigAudioSrc } from "../remote/sigAudio";

/**
 * 시그니처 플레이어 overlay (`/overlay/sigplayer/[key]`, code-first — StreamDonate 시그니처 플레이어 참고, 2026-10-25). Re-reads
 * the server every second. While a signature alert is on screen: for 노래 전 대기 seconds the 대기 단계 — the member the
 * supporter picked in their color (BJ 매치), else the donor and message — then the signature image big with its name, and
 * its sound when chosen. Times come from the server (shownAt · endsAt), so a reload lands on the same 단계.
 */
export function SigPlayerOverlay({ data }: { data: OverlaySigPlayer }) {
  const router = useRouter();
  useReloadSignal(data.reloadSeq);
  const now = useServerClock(data.serverNow);

  useEffect(() => {
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

  const a = data.alert;
  if (!a || !data.on || now === null || now >= Date.parse(a.endsAt)) return null;
  const s = data.settings;
  const leading = now < Date.parse(a.shownAt) + s.waitSec * 1000;
  return (
    <OverlayThemeRoot theme={data.theme} className={styles.stage}>
      {leading ? (
        <div key={`${a.id}-lead`} className={`${ov.card} ${styles.lead}`} style={a.member && s.mode === "MEMBER" ? ({ "--member": a.member.color } as CSSProperties) : undefined}>
          {s.mode === "MEMBER" && a.member ? (
            <>
              <span className={`${ov.muted} ${styles.kicker}`}>{a.donor} 님의 시그니처</span>
              <strong className={`${ov.display} ${styles.member}`}>{a.member.name}</strong>
            </>
          ) : (
            <>
              <strong className={`${ov.display} ${styles.donor}`}>{a.donor}</strong>
              {s.mode === "MESSAGE" && a.message && <span className={`${ov.label} ${styles.message}`}>{a.message}</span>}
              <span className={`${ov.muted} ${styles.kicker}`}>{a.signatureName}</span>
            </>
          )}
        </div>
      ) : (
        <figure key={`${a.id}-sig`} className={styles.sig}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signature images are library files or presets */}
          {a.imageUrl && <img src={a.imageUrl} alt="" />}
          <figcaption className={`${ov.card} ${ov.label} ${styles.caption}`}>
            {a.signatureName}
            {a.member && <span className={ov.muted}> · {a.member.name}</span>}
          </figcaption>
          {s.sound && a.soundUrl && <SigSound url={a.soundUrl} volume={data.volume} mode={data.sigFetch} />}
        </figure>
      )}
    </OverlayThemeRoot>
  );
}

/** The signature's sound, once, at the 리모컨 시그니처 볼륨 — fetched by the 시그니처 음원 받는 방식 (2026-10-28). */
function SigSound({ url, volume, mode }: { url: string; volume: number; mode: SigFetchMode }) {
  const ref = useRef<HTMLAudioElement>(null);
  const src = useSigAudioSrc(url, mode);
  useEffect(() => {
    if (ref.current) ref.current.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume, src]);
  return src ? <audio ref={ref} src={src} autoPlay /> : null;
}
