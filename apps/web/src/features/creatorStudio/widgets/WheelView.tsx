"use client";

import { useState, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { WHEEL_RESULT_SEC, WHEEL_STOP_SEC, type OverlayTool, type WheelSlice, type WheelSpin } from "@/services/creator/broadcastToolTypes";
import w from "./wheel.module.css";

/**
 * 원형 룰렛 (code-first, 2026-10-30 — StreamDonate 원형 룰렛 참고): the wheel of 칸 sized by ×수량 under a pointer at the top.
 * A spin turns fast until it stops (자동 멈춤: at once; 수동 멈춤: at 멈춤), then slows down over WHEEL_STOP_SEC onto the slice
 * the server drew — timed on the server clock, so a source opened late shows where the wheel is — and the result shows big
 * for WHEEL_RESULT_SEC, then as a line until the next spin.
 */

/** Where a slice sits: its start and end angle from the top, clockwise. */
export function sliceAngles(slices: { qty: number }[]) {
  const total = slices.reduce((s, x) => s + x.qty, 0) || 1;
  let acc = 0;
  return slices.map((x) => {
    const from = (acc / total) * 360;
    acc += x.qty;
    return { from, to: (acc / total) * 360 };
  });
}

/** The turn that brings the middle of slice `result` under the pointer, after `laps` full turns. */
export function landingTurn(slices: { qty: number }[], result: number, laps = 6) {
  const a = sliceAngles(slices)[result];
  return laps * 360 - (a.from + a.to) / 2;
}

const point = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return `${(r * Math.sin(rad)).toFixed(3)} ${(-r * Math.cos(rad)).toFixed(3)}`;
};

/** The disc: a slice per 칸 in its color, its label along the middle. */
export function WheelDisc({ slices, size = 300 }: { slices: WheelSlice[]; size?: number }) {
  const angles = sliceAngles(slices);
  return (
    <svg className={w.disc} viewBox="-100 -100 200 200" width={size} height={size} aria-hidden="true">
      {slices.map((s, i) => {
        const { from, to } = angles[i];
        const mid = (from + to) / 2;
        const span = to - from;
        const label = [...s.label].length > 8 ? `${[...s.label].slice(0, 7).join("")}…` : s.label;
        return (
          <g key={i}>
            {slices.length === 1 ? (
              <circle r={98} fill={s.color} />
            ) : (
              <path d={`M0 0 L${point(from, 98)} A98 98 0 ${span > 180 ? 1 : 0} 1 ${point(to, 98)} Z`} fill={s.color} stroke="rgba(0, 0, 0, 0.25)" strokeWidth={0.8} />
            )}
            {span >= 8 && (
              <text className={w.label} transform={`rotate(${mid}) translate(0 -62)`} fontSize={Math.min(12, 4 + span / 6)}>
                {label}
              </text>
            )}
          </g>
        );
      })}
      <circle r={12} className={w.hub} />
    </svg>
  );
}

/** The stopping wheel: slows down from the moment it mounts at `offset` seconds into the stop. */
function Stopping({ spin, now }: { spin: WheelSpin; now: number }) {
  const [offset] = useState(() => Math.max(0, (now - Date.parse(spin.stopAt!)) / 1000));
  return (
    <span className={w.turn} data-phase="stop" style={{ "--wheel-to": `${landingTurn(spin.slices, spin.result ?? 0)}deg`, animationDelay: `-${offset}s`, animationDuration: `${WHEEL_STOP_SEC}s` } as CSSProperties}>
      <WheelDisc slices={spin.slices} />
    </span>
  );
}

export function WheelOverlay({ data }: { data: Extract<OverlayTool, { tool: "wheel" }> }) {
  const now = useServerClock(data.serverNow);
  const spin = data.current;
  if (now === null || (!spin && !data.slices.length)) return null;
  const stopAt = spin?.stopAt ? Date.parse(spin.stopAt) : null;
  const stopping = spin !== null && stopAt !== null && now >= stopAt && spin.result !== null;
  const stopped = stopping && now >= stopAt! + WHEEL_STOP_SEC * 1000;
  const fresh = stopped && now < stopAt! + (WHEEL_STOP_SEC + WHEEL_RESULT_SEC) * 1000;
  const result = stopped ? spin!.slices[spin!.result!] : null;
  return (
    <OverlayThemeRoot theme={data.theme} className={w.pad}>
      <div className={`${ov.card} ${w.card}`}>
        <div className={w.head}>
          <span className={`${ov.chip} ${ov.chipAccent}`}>🎡 {data.title || "원형 룰렛"}</span>
          {spin?.donor && <span className={ov.chip}>{spin.donor} 님</span>}
          {data.waiting > 0 && <span className={ov.chip}>대기 {data.waiting}</span>}
        </div>
        <div className={w.stage}>
          <span className={w.pointer} aria-hidden="true" />
          {!spin ? (
            <WheelDisc slices={data.slices} />
          ) : stopping ? (
            <Stopping key={`${spin.id}-stop`} spin={spin} now={now} />
          ) : (
            <span key={`${spin.id}-spin`} className={w.turn} data-phase="spin">
              <WheelDisc slices={spin.slices} />
            </span>
          )}
        </div>
        {result && (
          <p key={`${spin!.id}-result`} className={`${ov.enter} ${w.result}`} data-fresh={fresh || undefined} data-motion="POP">
            <span className={ov.muted}>결과</span>
            <strong className={ov.display} style={{ color: result.color }}>
              {result.label}
            </strong>
          </p>
        )}
        {spin && !stopping && <p className={`${ov.label} ${w.status}`}>{spin.stopMode === "MANUAL" && !spin.stopAt ? "돌아가는 중… 멈춤을 기다려요" : "돌아가는 중…"}</p>}
      </div>
    </OverlayThemeRoot>
  );
}
