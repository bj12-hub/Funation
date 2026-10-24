"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { OneSourceView } from "@/services/creator/overlayLayoutTypes";
import local from "./oneSource.module.css";

/** Seconds between layout checks: a saved 배치 shows up in OBS within this. */
const POLL_MS = 5000;

/**
 * 원소스 오버레이 (`/overlay/onesource/[key]?canvas=…`) — code-first. One OBS browser source at the canvas size: each placed
 * overlay is its own page in a frame at its browser-source size, moved and scaled as placed, bottom layer first. The frames
 * keep running between layout checks; the stage scales to fit when the source is set to another size.
 */
export function OneSourceOverlay({ data }: { data: OneSourceView }) {
  const router = useRouter();
  const [fit, setFit] = useState(1);
  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    const poll = setInterval(() => router.refresh(), POLL_MS);
    return () => {
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);
  useEffect(() => {
    const size = () => setFit(Math.min(window.innerWidth / data.width, window.innerHeight / data.height) || 1);
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, [data.width, data.height]);

  // The frame box is the fitted size (a transform alone keeps the canvas's full size in the page and scrolls it).
  return (
    <div className={local.frame} style={{ width: data.width * fit, height: data.height * fit }}>
      <div className={local.stage} style={{ width: data.width, height: data.height, transform: `scale(${fit})` }}>
        {data.items.map((i) => (
          <iframe
            key={i.id}
            src={i.src}
            title={i.title}
            allow="autoplay"
            className={local.source}
            style={{ left: i.x, top: i.y, width: i.width, height: i.height, transform: `scale(${i.scale})` }}
          />
        ))}
      </div>
    </div>
  );
}
