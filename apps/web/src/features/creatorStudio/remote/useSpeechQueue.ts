"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SpeechPart } from "@/services/creator/customSoundSpeech";

/** Liveness guards only: a part whose end event never comes stops holding the queue after this long. */
const SAY_GUARD_MS = (text: string) => 3_000 + text.length * 300;
const SOUND_GUARD_MS = 60_000;

/**
 * Reads alerts aloud one after another (code-first): each part in turn — TTS for text (browser speech synthesis,
 * voices TBD), the 커스텀 사운드 in place of its word at the sound's volume × TTS volume. `stop` ends the current
 * reading and drops the waiting ones (TTS 스킵 · 음소거 · OFF).
 */
export function useSpeechQueue() {
  const run = useRef(0);
  const tail = useRef<Promise<void>>(Promise.resolve());
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    run.current += 1;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    audio.current?.pause();
    audio.current = null;
  }, []);

  const speak = useCallback((parts: SpeechPart[], ttsVolume: number) => {
    const id = run.current;
    const say = (text: string) =>
      new Promise<void>((resolve) => {
        if (typeof speechSynthesis === "undefined") return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ko-KR";
        u.volume = ttsVolume / 100;
        u.onend = u.onerror = () => resolve();
        setTimeout(resolve, SAY_GUARD_MS(text));
        speechSynthesis.speak(u);
      });
    const play = (url: string, volume: number) =>
      new Promise<void>((resolve) => {
        const a = new Audio(url);
        a.volume = (volume / 100) * (ttsVolume / 100);
        a.onended = a.onerror = a.onpause = () => resolve();
        audio.current = a;
        setTimeout(resolve, SOUND_GUARD_MS);
        a.play().catch(() => resolve()); // OBS allows autoplay; a normal browser tab may block it
      });
    tail.current = tail.current.then(async () => {
      for (const p of parts) {
        if (run.current !== id) return;
        if (p.kind === "TEXT") await say(p.text);
        else await play(p.url, p.volume);
      }
      audio.current = null;
    });
  }, []);

  useEffect(() => stop, [stop]);
  return { speak, stop };
}
