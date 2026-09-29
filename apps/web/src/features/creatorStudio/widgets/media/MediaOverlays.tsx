"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

/**
 * OBS video overlay (code-first): embeds the clip the server has on screen. The server ends it after its
 * range, so the iframe simply disappears; a new id remounts the player.
 */
export function VideoOverlay({ data }: { data: OverlayVideo }) {
  useOverlayPoll(data.reloadSeq);
  const p = data.playing;
  if (!p) return null;
  const src = `https://www.youtube-nocookie.com/embed/${p.videoId}?autoplay=1&controls=0&rel=0&start=${p.startSec}&end=${p.endSec}`;
  return (
    <div className={styles.video}>
      {/* Volume is applied by OBS audio control; the embed has no volume URL parameter (TBD: IFrame API). */}
      <iframe key={p.id} className={styles.frame} src={src} title="영상 후원" allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

/** OBS drawing overlay (code-first): the drawing on 전시 with the donor and title. */
export function DrawingOverlay({ data }: { data: OverlayDrawing }) {
  useOverlayPoll(data.reloadSeq);
  const d = data.drawing;
  if (!d) return null;
  return (
    <figure key={d.id} className={styles.drawing}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.image} alt={d.title} />
      <figcaption>
        <strong>{d.title}</strong>
        <span>
          {d.donor}
          {d.fnAmount > 0 ? ` · ${formatNumber(d.fnAmount)} FN` : ""}
        </span>
      </figcaption>
    </figure>
  );
}
