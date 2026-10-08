"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import type { GoalSettings } from "@/services/creator/widgetSettingsTypes";
import g from "./goalView.module.css";

export type GoalProgressView = { current: number; percent: number };

const OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000";

/** 하트 · 별 drawn in a 100 × 100 box. */
const HEART = "M50 90 C 20 68 5 50 5 31 C 5 16 16 6 29.5 6 C 38.5 6 45.5 11 50 18.5 C 54.5 11 61.5 6 70.5 6 C 84 6 95 16 95 31 C 95 50 80 68 50 90 Z";
const STAR = "M50 5 L61.8 37.6 L96.4 38.4 L69 59.6 L78.8 92.8 L50 73.2 L21.2 92.8 L31 59.6 L3.6 38.4 L38.2 37.6 Z";

/** Which of the two goals shows: the first, or the second every other `alternateSec` (wall clock, so reloads agree). */
function useAlternating(enabled: boolean, sec: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setIndex(0);
      return;
    }
    const tick = () => setIndex(Math.floor(Date.now() / 1000 / sec) % 2);
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [enabled, sec]);
  return enabled ? index : 0;
}

function Shape({ shape, percent }: { shape: GoalSettings["shape"]; percent: number }) {
  const clip = useId();
  const p = Math.max(0, Math.min(100, percent));
  if (shape === "CIRCLE" || shape === "SEMI") {
    const semi = shape === "SEMI";
    const d = semi ? "M 10 54 A 40 40 0 0 1 90 54" : "M 50 10 A 40 40 0 1 1 49.99 10";
    return (
      <svg className={g.svg} viewBox={semi ? "0 0 100 62" : "0 0 100 100"} aria-hidden="true">
        <path d={d} className={g.ringTrack} pathLength={100} />
        {p > 0 && <path d={d} className={g.ringFill} pathLength={100} style={{ strokeDasharray: `${p} 100` }} />}
      </svg>
    );
  }
  const path = shape === "HEART" ? HEART : STAR;
  return (
    <svg className={g.svg} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={path} />
        </clipPath>
      </defs>
      <path d={path} className={g.shapeTrack} />
      {/* The fill rises from the bottom of the shape's box (y 93 → 5); a CSS transform so it animates, inside the clipped group so the clip stays put. */}
      <g clipPath={`url(#${clip})`}>
        <rect x="0" y="0" width="100" height="100" className={g.shapeFill} style={{ transform: `translateY(${93 - 88 * (p / 100)}px)` }} />
      </g>
      <path d={path} className={g.shapeLine} />
    </svg>
  );
}

/**
 * 후원목표 (code-first visuals, 2026-10-08 오버레이 테마): 모양 막대 · 원형 · 반원 · 하트 · 별, optionally two goals
 * shown in turn. Drawn by the OBS overlay and the 후원목표 settings preview. Amounts come from the server.
 */
export function GoalView({
  settings: s,
  first,
  second,
  daysLeft,
  theme
}: {
  settings: GoalSettings;
  first: GoalProgressView;
  second: GoalProgressView | null;
  daysLeft: number | null;
  theme: ResolvedTheme;
}) {
  const index = useAlternating(s.second.enabled && second !== null, s.alternateSec);
  const goal = index === 1 && second ? { title: s.second.title, target: s.second.goalAmount, ...second } : { title: s.title, target: s.goalAmount, ...first };
  const colors = (s.customColors ? { "--ov-accent": s.barColor, "--ov-track-bg": s.barBackground } : {}) as CSSProperties;
  const text: CSSProperties = { fontFamily: `"${s.font.family}", var(--ov-body-font)`, fontSize: s.font.size, textShadow: s.textOutline ? OUTLINE : undefined };
  const amount = `${formatNumber(goal.current)} FN`;
  const pct = `${goal.percent.toFixed(goal.percent % 1 === 0 ? 0 : 1)}%`;
  const dots = s.second.enabled && second !== null && (
    <span className={g.dots} aria-hidden="true">
      <i data-on={index === 0 || undefined} />
      <i data-on={index === 1 || undefined} />
    </span>
  );

  if (s.shape === "BAR") {
    return (
      <OverlayThemeRoot theme={theme} className={g.root} data-shape="BAR" data-style={s.style} style={colors}>
        <div key={index} className={`${ov.enter} ${g.bar}`} data-motion="FADE">
          <div className={`${ov.onStream} ${ov.label} ${g.head}`} style={text}>
            <span className={g.title}>
              {dots}
              {goal.title}
            </span>
            {s.style !== "ONE_LINE" && (
              <strong className={`${ov.display} ${g.amount}`}>
                {amount}
                {s.showPercent && <small> · {pct}</small>}
              </strong>
            )}
          </div>
          <div
            className={`${ov.track} ${g.track}`}
            style={{ height: s.barHeight }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(goal.percent)}
            aria-label={`${goal.title} 달성률`}
          >
            <span className={ov.fill} style={{ width: `${goal.percent}%` }} />
            {s.style === "ONE_LINE" && s.showPercent && <span className={`${ov.display} ${g.inBar}`}>{pct}</span>}
          </div>
          {s.style === "ONE_LINE" && (
            <strong className={`${ov.onStream} ${ov.display} ${g.amount}`} style={text}>
              {amount}
            </strong>
          )}
          {s.style === "BASIC" && (
            <div className={`${ov.onStream} ${g.foot}`} style={{ ...text, fontSize: Math.max(12, Math.round(s.font.size * 0.85)) }}>
              <span>목표 {formatNumber(goal.target)} FN</span>
              {daysLeft !== null && <span>남은 기간 {daysLeft}일</span>}
            </div>
          )}
        </div>
      </OverlayThemeRoot>
    );
  }

  return (
    <OverlayThemeRoot theme={theme} className={g.root} data-shape={s.shape} style={colors}>
      <div key={index} className={`${ov.enter} ${g.shapeRow}`} data-motion="FADE">
        <span
          className={g.shapeBox}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(goal.percent)}
          aria-label={`${goal.title} 달성률`}
        >
          <Shape shape={s.shape} percent={goal.percent} />
          {s.showPercent && <span className={`${ov.display} ${g.shapePct}`}>{pct}</span>}
        </span>
        <span className={`${ov.onStream} ${g.shapeText}`} style={text}>
          <span className={`${ov.label} ${g.title}`}>
            {dots}
            {goal.title}
          </span>
          <strong className={`${ov.display} ${g.amount}`}>{amount}</strong>
          <span className={g.sub}>
            목표 {formatNumber(goal.target)} FN{daysLeft !== null && ` · 남은 기간 ${daysLeft}일`}
          </span>
        </span>
      </div>
    </OverlayThemeRoot>
  );
}
