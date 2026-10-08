"use client";

import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import type { ClockSettings } from "@/services/creator/widgetSettingsTypes";
import c from "./clockView.module.css";

/** Korean time parts for `ms` (Asia/Seoul whatever the OBS PC's zone is). */
function kst(ms: number) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(ms));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return { month: get("month"), day: get("day"), weekday: get("weekday"), h: Number(get("hour")), m: Number(get("minute")), s: Number(get("second")) };
}

const two = (n: number) => String(n).padStart(2, "0");

/**
 * 시계 (code-first, 2026-10-08, from the legacy FlexTV 도우미 시계): 플립 · 디지털 · 아날로그 in the overlay theme. `now`
 * is server time corrected for skew (null before mount — nothing shows, so server and client markup match).
 */
export function ClockView({ settings: s, now, theme }: { settings: ClockSettings; now: number | null; theme: ResolvedTheme }) {
  if (now === null) return null;
  const t = kst(now);
  const half = t.h < 12 ? "오전" : "오후";
  const hour = s.hour12 ? (t.h % 12 === 0 ? 12 : t.h % 12) : t.h;
  const groups = [two(hour), two(t.m), ...(s.showSeconds ? [two(t.s)] : [])];
  const date = `${t.month}월 ${t.day}일 (${t.weekday})`;

  return (
    <OverlayThemeRoot theme={theme} className={c.root} data-style={s.style}>
      <div className={`${s.style === "DIGITAL" && theme.theme === "BOLD" ? ov.accentCard : ov.card} ${c.face}`}>
        {s.label && <span className={`${ov.chip} ${ov.chipAccent} ${c.label}`}>{s.label}</span>}
        {s.style === "ANALOG" ? (
          <span className={c.analogRow}>
            <svg className={c.dial} viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="46" className={c.dialFace} />
              {Array.from({ length: 12 }, (_, i) => (
                <line key={i} x1="50" y1="8" x2="50" y2={i % 3 === 0 ? 16 : 13} className={c.tick} transform={`rotate(${i * 30} 50 50)`} />
              ))}
              <line x1="50" y1="50" x2="50" y2="27" className={c.hourHand} transform={`rotate(${(t.h % 12) * 30 + t.m * 0.5} 50 50)`} />
              <line x1="50" y1="50" x2="50" y2="17" className={c.minuteHand} transform={`rotate(${t.m * 6 + t.s * 0.1} 50 50)`} />
              {s.showSeconds && <line x1="50" y1="56" x2="50" y2="14" className={c.secondHand} transform={`rotate(${t.s * 6} 50 50)`} />}
              <circle cx="50" cy="50" r="3" className={c.pin} />
            </svg>
            <span className={c.analogText}>
              <strong className={`${ov.display} ${c.small}`} aria-label={`${s.hour12 ? half + " " : ""}${groups.join(":")}`}>
                {s.hour12 && <small>{half} </small>}
                {groups.join(":")}
              </strong>
              {s.showDate && <span className={ov.muted}>{date}</span>}
            </span>
          </span>
        ) : (
          <>
            <strong className={`${ov.display} ${c.time}`} aria-label={`${s.hour12 ? half + " " : ""}${groups.join(":")}`}>
              {s.hour12 && <small className={c.half}>{half}</small>}
              {s.style === "FLIP"
                ? groups.map((gp, i) => (
                    <span key={i} className={c.flipGroup}>
                      {i > 0 && <span className={c.colon}>:</span>}
                      {[...gp].map((d, j) => (
                        <span key={`${i}-${j}-${d}`} className={c.flip}>
                          {d}
                        </span>
                      ))}
                    </span>
                  ))
                : groups.join(":")}
            </strong>
            {s.showDate && <span className={`${ov.muted} ${c.date}`}>{date}</span>}
          </>
        )}
      </div>
    </OverlayThemeRoot>
  );
}
