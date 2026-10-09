"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { OverlayAlert } from "@/services/creator/alertTypes";
import { speechParts } from "@/services/creator/customSoundSpeech";
import { AlertCard } from "./AlertCard";
import { useReloadSignal } from "./useReloadSignal";
import { useSpeechQueue } from "./useSpeechQueue";

/**
 * OBS alert overlay (code-first). Transparent page that re-reads the server queue every second and
 * shows the alert the server has on screen, drawn as the 후원 알림 design says (AlertCard, 오버레이 테마). Reads the message aloud with the browser's speech
 * synthesis when TTS volume > 0 and not muted (voices TBD), playing each 커스텀 사운드 in place of its word, and plays a
 * 시그니처's sound at 시그니처 볼륨.
 */
export function AlertOverlay({ data, vertical = false }: { data: OverlayAlert; vertical?: boolean }) {
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
  const { speak, stop } = useSpeechQueue();

  // TTS 스킵 from the remote: stop speaking (the card stays until its time is up).
  const skipSeq = useRef(data.ttsSkipSeq);
  useEffect(() => {
    if (data.ttsSkipSeq === skipSeq.current) return;
    skipSeq.current = data.ttsSkipSeq;
    stop();
  }, [data.ttsSkipSeq, stop]);
  // 음소거 or OFF also stops the reading (and the 커스텀 사운드 in it), like the 시그니처 sound below.
  useEffect(() => {
    if (controls.muted || !data.on) stop();
  }, [controls.muted, data.on, stop]);

  useEffect(() => {
    if (!alert || spoken.current === alert.id) return;
    spoken.current = alert.id;
    if (!data.on || controls.muted || controls.ttsVolume === 0 || !alert.message) return;
    speak(speechParts(alert.message, data.customSounds), controls.ttsVolume);
  }, [alert, controls.muted, controls.ttsVolume, data.on, data.customSounds, speak]);

  // 시그니처 소리: played once per alert at 시그니처 볼륨.
  useEffect(() => {
    if (!alert?.soundUrl || played.current === alert.id) return;
    played.current = alert.id;
    // The previous alert's sound stops first, also when this one stays silent (볼륨 0 · 음소거 · OFF).
    sound.current?.pause();
    sound.current = null;
    if (!data.on || controls.muted || controls.signatureVolume === 0) return;
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
  return <AlertCard alert={alert} design={data.design} theme={data.theme} vertical={vertical} />;
}
