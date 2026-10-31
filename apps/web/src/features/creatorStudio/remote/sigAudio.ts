"use client";

import { useEffect, useState } from "react";
import type { SigFetchMode } from "@/services/creator/widgetSettingsTypes";

/** The address with a query the media route ignores, so the browser cache never answers it (매번 새로 받기). */
const fresh = (url: string) => `${url}${url.includes("?") ? "&" : "?"}fresh=${Date.now().toString(36)}`;

/**
 * A signature's sound by 시그니처 음원 받는 방식 (2026-10-28): CACHE as before (the browser cache, streamed), FRESH past the
 * cache (streamed), FULL past the cache and downloaded whole before it starts (no gaps; a slow network starts it later).
 * The download starts at once; `play()` starts the sound (FULL: once it is in), `stop()` stops it and any download.
 */
export function sigAudio(url: string, mode: SigFetchMode) {
  let volume = 1;
  let wanted = false;
  let stopped = false;
  let objectUrl: string | null = null;
  let audio: HTMLAudioElement | null = mode === "FULL" ? null : new Audio(mode === "FRESH" ? fresh(url) : url);
  const download = new AbortController();
  const start = () => {
    if (!audio || stopped) return;
    audio.volume = volume;
    audio.play().catch(() => {}); // OBS allows autoplay; a normal browser tab may block it
  };
  if (mode === "FULL") {
    fetch(url, { cache: "no-store", signal: download.signal })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (stopped) return;
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        if (wanted) start();
      })
      .catch(() => {}); // a failed download plays nothing, like a missing file
  }
  return {
    setVolume(v: number) {
      volume = v;
      if (audio) audio.volume = v;
    },
    play() {
      wanted = true;
      start();
    },
    stop() {
      stopped = true;
      download.abort();
      audio?.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };
}

/** The `<audio>` source for a signature's sound by 시그니처 음원 받는 방식 — null while a FULL download is still coming. */
export function useSigAudioSrc(url: string, mode: SigFetchMode): string | null {
  const [src, setSrc] = useState<string | null>(() => (mode === "FULL" ? null : mode === "FRESH" ? fresh(url) : url));
  useEffect(() => {
    if (mode !== "FULL") return;
    let objectUrl: string | null = null;
    const download = new AbortController();
    fetch(url, { cache: "no-store", signal: download.signal })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {});
    return () => {
      download.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, mode]);
  return src;
}
