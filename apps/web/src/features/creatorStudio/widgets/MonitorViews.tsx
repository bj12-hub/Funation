"use client";

import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import type { MonitorLine, SigCard, TopDonation } from "@/services/creator/widgetOverlayTypes";
import type { DonationMonitorSettings, SigQueueSettings, TopDonationSettings } from "@/services/creator/widgetSettingsTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import m from "./monitorViews.module.css";

/**
 * 알림 모니터 views (code-first, 2026-10-23 — StreamDonate 최고 후원 · 후원 모니터링 · 시그 큐 모니터 참고). Drawn by the
 * OBS overlays and, with sample data, by the settings popups. Each shows nothing while it has nothing to show.
 */

/** "12초 전" · "3분 전" · "2시간 전" against `now` (the server clock on the overlay). */
export function agoText(at: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(at).getTime()) / 1000));
  if (s < 60) return `${s}초 전`;
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  return `${Math.floor(s / 3600)}시간 전`;
}

// ── 최고 후원 ─────────────────────────────────────────────────────────────────

export function TopDonationView({ settings: s, top, theme }: { settings: TopDonationSettings; top: TopDonation | null; theme: ResolvedTheme }) {
  if (!top) return null;
  return (
    <OverlayThemeRoot theme={theme} className={m.pad}>
      <div className={`${theme.theme === "BOLD" ? ov.accentCard : ov.card} ${m.top}`}>
        <div className={m.topHead}>
          <span className={`${ov.chip} ${ov.chipAccent}`}>🥇 {s.title}</span>
          {s.prize && <span className={`${ov.chip} ${m.prize}`}>{s.prize}</span>}
        </div>
        {/* A new top donation comes in with the theme's entrance. */}
        <div key={`${top.donor}|${top.at}`} className={`${ov.enter} ${m.topBody}`} data-motion="POP">
          <strong className={`${ov.label} ${m.topName}`}>{top.donor}</strong>
          <span className={`${ov.display} ${m.topAmount}`}>{top.amount}</span>
        </div>
        {s.showMessage && top.message && <p className={`${ov.muted} ${m.message}`}>{top.message}</p>}
      </div>
    </OverlayThemeRoot>
  );
}

// ── 후원 모니터링 ─────────────────────────────────────────────────────────────

/** `now` null (before the clock is known): the "N초 전" is left out. */
export function DonationMonitorView({ settings: s, line, theme, now }: { settings: DonationMonitorSettings; line: MonitorLine | null; theme: ResolvedTheme; now: number | null }) {
  if (!line) return null;
  const compact = s.layout === "COMPACT";
  return (
    <OverlayThemeRoot theme={theme} className={m.pad}>
      <div key={line.id} className={`${ov.enter} ${theme.theme === "BOLD" ? ov.accentCard : ov.card} ${m.monitor}`} data-motion="SLIDE_SIDE" data-compact={compact || undefined}>
        {!compact && (
          <div className={m.monitorHead}>
            {now !== null && <span className={ov.chip}>{agoText(line.at, now)}</span>}
            {line.playing && <span className={`${ov.chip} ${ov.chipAccent}`}>재생 중</span>}
            {line.test && <span className={ov.chip}>테스트</span>}
            <span className={ov.muted}>{line.platform ? `${PLATFORM_LABEL[line.platform]} · ${line.typeLabel}` : line.typeLabel}</span>
          </div>
        )}
        <div className={m.monitorMain}>
          <strong className={`${ov.label} ${m.monitorName}`}>{line.donor}</strong>
          {!compact && <span className={`${ov.display} ${m.monitorAmount}`}>{line.amount}</span>}
        </div>
        {line.message && <p className={`${compact ? "" : ov.muted} ${m.message}`}>{line.message}</p>}
      </div>
    </OverlayThemeRoot>
  );
}

// ── 시그 큐 모니터 ────────────────────────────────────────────────────────────

export function SigQueueView({ settings: s, cards, theme }: { settings: SigQueueSettings; cards: SigCard[]; theme: ResolvedTheme }) {
  if (!cards.length) return null;
  return (
    <OverlayThemeRoot theme={theme} className={m.pad}>
      <ol className={m.queue} data-layout={s.layout}>
        {cards.map((c) => (
          <li key={c.id} className={`${ov.enter} ${ov.card} ${m.sig}`} data-motion="SLIDE_UP" data-playing={c.playing || undefined}>
            {s.showOrder && <span className={`${ov.chip} ${c.playing ? ov.chipAccent : ""} ${m.order}`}>{c.playing ? `${c.order} · 재생 중` : c.order}</span>}
            {/* eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock) */}
            <img src={c.imageUrl} alt="" className={m.sigImage} />
            <span className={m.sigText}>
              <strong className={ov.label}>{c.donor}</strong>
              {!s.compact && <span className={ov.display}>{c.amount}</span>}
              {c.message && <span className={`${ov.muted} ${m.sigMessage}`}>{c.message}</span>}
            </span>
          </li>
        ))}
      </ol>
    </OverlayThemeRoot>
  );
}
