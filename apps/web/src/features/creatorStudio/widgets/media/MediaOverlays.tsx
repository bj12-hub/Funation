"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { formatNumber } from "@/lib/format";
import type { OverlayDrawing, OverlayVideo } from "@/services/creator/mediaTypes";
import { useReloadSignal } from "../../remote/useReloadSignal";
import styles from "./mediaOverlay.module.css";

/** Transparent page + 1s server poll, shared by the OBS media overlays. */
function useOverlayPoll(reloadSeq: number) {
  const router = useRouter();
  useReloadSignal(reloadSeq);
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
}

/** YouTube IFrame API command over postMessage (no script tag needed). */
function sendVolume(frame: HTMLIFrameElement | null, volume: number) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [volume] }), "https://www.youtube-nocookie.com");
}

/**
 * OBS video overlay (code-first): embeds the clip the server has on screen. The server ends it after its
 * range, so the iframe simply disappears; a new id remounts the player. 볼륨 (리모컨 · 영상 후원 설정) is
 * sent to the player through the YouTube IFrame API message channel (`enablejsapi=1`).
 */
export function VideoOverlay({ data }: { data: OverlayVideo }) {
  useOverlayPoll(data.reloadSeq);
  const frame = useRef<HTMLIFrameElement>(null);
  const p = data.playing;
  const volume = data.volume;
  // Volume changed while a clip plays.
  useEffect(() => sendVolume(frame.current, volume), [volume]);
  // 리모컨 기능 제어 OFF: no player at all (so no sound either).
  if (!p || !data.on) return null;
  const src = `https://www.youtube-nocookie.com/embed/${p.videoId}?autoplay=1&controls=0&rel=0&enablejsapi=1&start=${p.startSec}&end=${p.endSec}`;
  return (
    <OverlayThemeRoot theme={data.theme} className={styles.video}>
      <iframe
        ref={frame}
        key={p.id}
        className={styles.frame}
        src={src}
        title="영상 후원"
        allow="autoplay; encrypted-media"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => sendVolume(frame.current, volume)}
      />
      {/* Who sent it, in the 영상 후원 오버레이 테마, over the bottom-left corner. */}
      <p key={`cap-${p.id}`} className={`${ov.enter} ${ov.card} ${ov.pill} ${styles.caption}`} data-motion="SLIDE_UP">
        <span className={`${ov.chip} ${ov.chipAccent}`}>영상 후원</span>
        <b className={ov.label}>{p.donor}</b>
        {p.fnAmount > 0 && <span className={ov.display}>{formatNumber(p.fnAmount)} FN</span>}
      </p>
    </OverlayThemeRoot>
  );
}

/** OBS drawing overlay (code-first): the drawing on 전시 with the donor and title. */
export function DrawingOverlay({ data }: { data: OverlayDrawing }) {
  useOverlayPoll(data.reloadSeq);
  const d = data.drawing;
  if (!d || !data.on) return null;
  return (
    <OverlayThemeRoot theme={data.theme} as="figure" key={d.id} className={`${ov.enter} ${styles.drawing}`} data-motion="POP">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.image} alt={d.title} className={styles.art} />
      <figcaption className={`${data.theme.theme === "BOLD" ? ov.accentCard : ov.card} ${styles.plate}`}>
        <span className={`${ov.chip} ${styles.plateChip}`}>그림후원</span>
        <strong className={ov.label}>{d.title}</strong>
        <span className={ov.muted}>
          {d.donor}
          {d.fnAmount > 0 ? ` · ${formatNumber(d.fnAmount)} FN` : ""}
        </span>
      </figcaption>
    </OverlayThemeRoot>
  );
}
