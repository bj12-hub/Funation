"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./previewStage.module.css";

/**
 * A stream-like backdrop that draws an overlay at its OBS width and scales it down to fit (studio previews,
 * code-first). The overlay is the real component, so what shows here is what goes on stream.
 */
export function PreviewStage({ width, minHeight = 0, children, label = "오버레이 미리보기" }: { width: number; minHeight?: number; children: ReactNode; label?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const fit = () => {
      const k = Math.min(1, o.clientWidth / width);
      setScale(k);
      setHeight(Math.max(minHeight, i.offsetHeight) * k);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width, minHeight]);

  return (
    <div ref={outer} className={s.stage} style={height === null ? undefined : { height }} aria-label={label} role="img">
      <div ref={inner} className={s.inner} style={{ width, minHeight, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
