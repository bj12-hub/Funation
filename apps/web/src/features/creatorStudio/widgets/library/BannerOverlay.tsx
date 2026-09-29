"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { slideIndexAt, type OverlayBanner } from "@/services/creator/bannerTypes";
import { useReloadSignal } from "../../remote/useReloadSignal";
import styles from "./bannerOverlay.module.css";

/**
 * OBS banner overlay (code-first): cycles the library slides at the chosen position. Settings come from
 * the server every 5s; the slide index follows the clock so every copy of the overlay stays in step.
 */
export function BannerOverlay({ data }: { data: OverlayBanner }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  useReloadSignal(data.reloadSeq);

  useEffect(() => {
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 500);
    const poll = setInterval(() => router.refresh(), 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);

  if (!data.enabled || now === null) return null;
  const current = slideIndexAt(now, data.intervalSec, data.slides.length);
  return (
    <div className={styles.stage} data-position={data.position}>
      <div className={styles.frame}>
        {data.slides.map((s, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={s.id} className={styles.slide} src={s.url} alt="" data-on={i === current ? "" : undefined} />
        ))}
      </div>
    </div>
  );
}
