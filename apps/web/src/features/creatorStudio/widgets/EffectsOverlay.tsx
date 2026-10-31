"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LAYER_EFFECTS, type OverlayEffects } from "@/services/creator/effectsTypes";
import { useReloadSignal } from "../remote/useReloadSignal";
import styles from "./effectsOverlay.module.css";

type Particle = { id: number; char: string; x: number; delay: number; duration: number; size: number; drift: number };

const LAYER_COUNT = 48;

/**
 * OBS effects overlay (code-first). Re-reads the server every second; when a new alert goes on screen it
 * plays the effects the server resolved for that alert: an emoji burst rising from the bottom and/or a
 * full-screen layer (falling particles), and the 구간's 영상 once in the middle (2026-10-25 — with sound; a browser that
 * blocks sound plays it muted). Positions are randomised in the browser (display only).
 */
export function EffectsOverlay({ data }: { data: OverlayEffects }) {
  const router = useRouter();
  const played = useRef<string | null>(null);
  const [burst, setBurst] = useState<{ key: string; emoji: Particle[]; layer: Particle[] } | null>(null);
  const [video, setVideo] = useState<{ key: string; url: string } | null>(null);
  useReloadSignal(data.reloadSeq);

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

  useEffect(() => {
    if (!data.alertId || played.current === data.alertId) return;
    played.current = data.alertId;
    if (!data.on) return;
    if (data.video) setVideo({ key: data.alertId, url: data.video });
    if (!data.emoji && !data.layer) return;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const emoji = data.emoji
      ? Array.from({ length: data.emoji.count }, (_, i) => ({
          id: i,
          char: data.emoji!.emojis[i % data.emoji!.emojis.length],
          x: rand(5, 95),
          delay: rand(0, 1.2),
          duration: rand(2.4, 3.6),
          size: rand(28, 56),
          drift: rand(-60, 60)
        }))
      : [];
    const layerChar = data.layer ? LAYER_EFFECTS.find((l) => l.key === data.layer)!.emoji : "";
    const layer = data.layer
      ? Array.from({ length: LAYER_COUNT }, (_, i) => ({ id: i, char: layerChar, x: rand(0, 100), delay: rand(0, 2), duration: rand(3, 5), size: rand(18, 40), drift: rand(-40, 40) }))
      : [];
    setBurst({ key: data.alertId, emoji, layer });
    const clear = setTimeout(() => setBurst(null), 7000);
    return () => clearTimeout(clear);
  }, [data]);

  if ((!burst && !video) || !data.on) return null;
  const style = (p: Particle) =>
    ({ left: `${p.x}%`, fontSize: `${p.size}px`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, "--drift": `${p.drift}px` }) as CSSProperties;
  return (
    <div className={styles.stage} key={burst?.key ?? video?.key} aria-hidden="true">
      {video && <EffectVideo key={video.key} url={video.url} onDone={() => setVideo(null)} />}
      {burst?.layer.map((p) => (
        <span key={`l${p.id}`} className={styles.fall} style={style(p)}>
          {p.char}
        </span>
      ))}
      {burst?.emoji.map((p) => (
        <span key={`e${p.id}`} className={styles.rise} style={style(p)}>
          {p.char}
        </span>
      ))}
    </div>
  );
}

/** The 구간's 영상, once: with sound, or muted when the browser refuses to start it with sound. */
function EffectVideo({ url, onDone }: { url: string; onDone: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(onDone);
    });
  }, [onDone]);
  return <video ref={ref} className={styles.video} src={url} playsInline onEnded={onDone} onError={onDone} />;
}
