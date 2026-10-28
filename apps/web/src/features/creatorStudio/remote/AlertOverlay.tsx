"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ALERT_ROLL_MS, type OverlayAlert } from "@/services/creator/alertTypes";
import { ALERT_SOUND_MAX_SEC } from "@/services/creator/widgetSettingsTypes";
import { alertSpeech } from "@/services/creator/customSoundSpeech";
import { AlertCard, rollsIn } from "./AlertCard";
import { sigAudio } from "./sigAudio";
import { useReloadSignal } from "./useReloadSignal";
import { useSpeechQueue } from "./useSpeechQueue";

/**
 * OBS alert overlay (code-first). Transparent page that re-reads the server queue every second and
 * shows the alert the server has on screen, drawn as the 후원 알림 design says (AlertCard, 오버레이 테마). Reads the message aloud with the browser's speech
 * synthesis when TTS volume > 0, not muted and 후원 메시지 표시 is on (voices TBD), playing each 커스텀 사운드 in place of its
 * word, and plays a 시그니처's sound at 시그니처 볼륨 (after the 랜덤시그 알림 롤링, when the card opens with one), fetched by the
 * 시그니처 음원 받는 방식. 알림 사운드 (2026-10-28): the design's sound plays first on every alert at 후원 알림음 volume, for at
 * most ALERT_SOUND_MAX_SEC, and the TTS and the signature's sound start once it ends.
 */
export function AlertOverlay({ data, vertical = false }: { data: OverlayAlert; vertical?: boolean }) {
  const router = useRouter();
  const spoken = useRef<string | null>(null);
  const played = useRef<string | null>(null);
  const sound = useRef<ReturnType<typeof sigAudio> | null>(null);
  const soundStart = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showMessage = data.design.showMessage;
  const showImage = data.design.showImage;
  const alertId = alert?.id ?? null;

  // 알림 사운드: when it ends (or after ALERT_SOUND_MAX_SEC, or at once without one — none, 볼륨 0, 음소거, OFF, a file that
  // will not play), `lead` becomes the alert's id and the TTS and the signature's sound may start.
  const [lead, setLead] = useState<string | null>(null);
  const leadFor = useRef<string | null>(null);
  const leadSound = useRef<{ audio: HTMLAudioElement; cap: ReturnType<typeof setTimeout> } | null>(null);
  const arrivedAt = useRef(0);
  useEffect(() => {
    if (!alertId || leadFor.current === alertId) return;
    leadFor.current = alertId;
    arrivedAt.current = Date.now();
    if (leadSound.current) {
      clearTimeout(leadSound.current.cap);
      leadSound.current.audio.pause();
      leadSound.current = null;
    }
    if (!data.alertSound || !data.on || controls.muted || controls.alertVolume === 0) {
      setLead(alertId);
      return;
    }
    const audio = new Audio(data.alertSound);
    audio.volume = controls.alertVolume / 100;
    const finish = () => {
      if (leadSound.current?.audio !== audio) return; // a newer alert took over
      clearTimeout(leadSound.current.cap);
      audio.pause();
      leadSound.current = null;
      setLead(alertId);
    };
    leadSound.current = { audio, cap: setTimeout(finish, ALERT_SOUND_MAX_SEC * 1000) };
    audio.onended = finish;
    audio.onerror = finish;
    audio.play().catch(finish);
  }, [alertId, data.alertSound, data.on, controls.muted, controls.alertVolume]);
  // The 알림 사운드 follows the remote too: a new volume at once; 음소거 or OFF silences it (the lead still ends on time).
  useEffect(() => {
    const l = leadSound.current;
    if (!l) return;
    if (!data.on || controls.muted) l.audio.pause();
    else l.audio.volume = controls.alertVolume / 100;
  }, [controls.muted, controls.alertVolume, data.on]);

  useEffect(() => {
    if (!alert || spoken.current === alert.id || lead !== alert.id) return;
    spoken.current = alert.id;
    // 후원 메시지 표시 off: the message is not read either (2026-10-09 결정, alertSpeech).
    const parts = alertSpeech({ message: alert.message, showMessage, on: data.on, muted: controls.muted, ttsVolume: controls.ttsVolume, sounds: data.customSounds });
    if (parts.length > 0) speak(parts, controls.ttsVolume);
  }, [alert, lead, controls.muted, controls.ttsVolume, data.on, data.customSounds, showMessage, speak]);

  // 시그니처 소리: played once per alert at 시그니처 볼륨, after the 알림 사운드 — and not before a 랜덤시그 알림 롤링 stops,
  // if the card opens with one.
  useEffect(() => {
    if (!alert?.soundUrl || played.current === alert.id || lead !== alert.id) return;
    played.current = alert.id;
    // The previous alert's sound stops first, also when this one stays silent (볼륨 0 · 음소거 · OFF).
    sound.current?.stop();
    sound.current = null;
    if (soundStart.current) clearTimeout(soundStart.current);
    if (!data.on || controls.muted || controls.signatureVolume === 0) return;
    const s = sigAudio(alert.soundUrl, data.design.sigFetch);
    s.setVolume(controls.signatureVolume / 100);
    sound.current = s;
    // Muted, OFF or a new alert in the meantime: it stays silent (the effect below dropped it).
    const wait = Math.max(0, (rollsIn(alert, showImage) ? ALERT_ROLL_MS : 0) - (Date.now() - arrivedAt.current));
    soundStart.current = setTimeout(() => sound.current === s && s.play(), wait);
  }, [alert, lead, controls.muted, controls.signatureVolume, data.on, data.design.sigFetch, showImage]);

  // The playing sound follows the remote: a new volume applies at once; mute, OFF or the alert leaving stops it.
  useEffect(() => {
    const s = sound.current;
    if (!s) return;
    if (alertId !== played.current || !data.on || controls.muted) {
      s.stop();
      sound.current = null;
    } else s.setVolume(controls.signatureVolume / 100);
  }, [alertId, controls.muted, controls.signatureVolume, data.on]);
  useEffect(
    () => () => {
      if (soundStart.current) clearTimeout(soundStart.current);
      sound.current?.stop();
      if (leadSound.current) {
        clearTimeout(leadSound.current.cap);
        leadSound.current.audio.pause();
      }
    },
    []
  );

  // 리모컨 기능 제어 OFF: nothing on screen and no TTS.
  if (!alert || !data.on) return null;
  return <AlertCard alert={alert} design={data.design} theme={data.theme} vertical={vertical} />;
}
