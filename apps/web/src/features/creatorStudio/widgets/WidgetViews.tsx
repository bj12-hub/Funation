"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { leaveForEffect, motionForEffect, type ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { fillRank, fillTotal, rankAmountText } from "@/services/creator/widgetOverlayCore";
import type { WidgetFeedLine, WidgetRankRow } from "@/services/creator/widgetOverlayTypes";
import { RECENT_PLATFORMS, type EventSettings, type QrSettings, type RankingSettings, type RecentSettings, type TotalSettings } from "@/services/creator/widgetSettingsTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import v from "./widgetViews.module.css";

/**
 * 후원 위젯 views (code-first, 2026-10-08 오버레이 테마) — 후원누적금액 · 후원랭킹 · 최근알림 · 이벤트 · 후원 QR코드.
 * Drawn by the OBS overlays and, with sample data, by the settings popups, so each preview is its overlay.
 * With 배경 카드 the theme draws the card and its colors; without it the text sits on the stream in the widget's
 * own font colors (and outline), as before the redesign.
 */

const OUTLINE = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000";
const SCROLL_SEC = { VERY_SLOW: 40, SLOW: 30, NORMAL: 20, FAST: 12, VERY_FAST: 7 } as const;
const QR_RADIUS = { BASIC: 0, ROUND: 16, CIRCLE: 999, SOFT: 32 } as const;
/** Ssumnation's own donations in feed lines. */
const OWN_COLOR = "#A78BFA";

const font = (f: { family: string; size: number; color?: string }, opts: { color?: boolean; outline?: boolean } = {}): CSSProperties => ({
  fontFamily: `"${f.family}", var(--ov-body-font)`,
  fontSize: f.size,
  color: opts.color === false ? undefined : f.color,
  textShadow: opts.outline ? OUTLINE : undefined
});

// ── 후원누적금액 ──────────────────────────────────────────────────────────────

export function TotalView({ settings: s, total, theme }: { settings: TotalSettings; total: number; theme: ResolvedTheme }) {
  const amount = fillTotal(s.template, total);
  if (s.card) {
    return (
      <OverlayThemeRoot theme={theme} className={v.pad}>
        <div className={`${theme.theme === "BOLD" ? ov.accentCard : ov.card} ${v.total}`}>
          <span className={`${ov.label} ${v.totalTitle}`} style={font(s.titleFont, { color: false })}>
            {s.title}
          </span>
          <strong className={`${ov.display} ${v.totalAmount}`} style={{ fontSize: s.contentFont.size * 1.3 }}>
            {amount}
          </strong>
        </div>
      </OverlayThemeRoot>
    );
  }
  return (
    <OverlayThemeRoot theme={theme} className={`${v.pad} ${v.totalPlain}`}>
      <span className={`${ov.onStream} ${ov.label}`} style={font(s.titleFont, { outline: s.textOutline })}>
        {s.title}
      </span>
      <strong className={`${ov.onStream} ${ov.display}`} style={font(s.contentFont, { outline: s.textOutline })}>
        {amount}
      </strong>
    </OverlayThemeRoot>
  );
}

// ── 후원랭킹 ──────────────────────────────────────────────────────────────────

export function RankingView({ settings: s, rows, theme, empty }: { settings: RankingSettings; rows: WidgetRankRow[]; theme: ResolvedTheme; empty?: string }) {
  const scroll = s.style === "SCROLL_TEXT";
  const row = (r: WidgetRankRow, copy = "") => {
    const tier = r.rank === 1 ? s.first : s.others;
    const rank = fillRank(s.format.rank, r.rank, r.name, r.fnAmount, r.amountLabel);
    const name = fillRank(s.format.name, r.rank, r.name, r.fnAmount, r.amountLabel);
    const amount = s.showAmount ? rankAmountText(s.format.amount, r) : null;
    if (s.card) {
      return (
        <li key={copy + r.rank + r.name} className={`${v.rankRow} ${s.style === "LINE_BOX" ? ov.card : ""}`} data-rank={r.rank <= 3 ? r.rank : undefined} aria-hidden={copy ? true : undefined} style={{ fontSize: tier.font.size }}>
          <span className={`${ov.display} ${v.rankBadge}`}>{rank}</span>
          <span className={`${ov.label} ${v.rankName}`}>{name}</span>
          {amount && <span className={`${ov.display} ${v.rankAmount}`}>{amount}</span>}
        </li>
      );
    }
    return (
      <li key={copy + r.rank + r.name} className={`${ov.onStream} ${v.rankRow}`} aria-hidden={copy ? true : undefined} style={font(tier.font)}>
        <span>{rank}</span>
        <span style={{ color: tier.accentColor }}>{name}</span>
        {amount && <span style={{ color: tier.accentColor }}>{amount}</span>}
      </li>
    );
  };
  const panel = s.card && s.style !== "LINE_BOX";
  return (
    <OverlayThemeRoot theme={theme} className={`${v.pad} ${v.ranking} ${panel ? ov.card : ""}`} data-style={s.style} data-card={s.card || undefined}>
      <strong className={s.card ? `${ov.chip} ${ov.chipAccent} ${v.rankTitle}` : `${ov.onStream} ${ov.label}`} style={s.card ? { fontSize: Math.max(14, s.titleFont.size * 0.7) } : font(s.titleFont)}>
        {s.title}
      </strong>
      {rows.length === 0 && empty && <span className={s.card ? ov.muted : ov.onStream}>{empty}</span>}
      {rows.length > 0 &&
        (scroll ? (
          <div className={v.scroll}>
            {/* Two copies keep the line moving without a gap. */}
            <ol style={{ gap: s.scrollGap, animationDuration: `${SCROLL_SEC[s.scrollSpeed]}s` }}>
              {rows.map((r) => row(r))}
              {rows.map((r) => row(r, "again-"))}
            </ol>
          </div>
        ) : (
          <ol className={v.rankList}>{rows.map((r) => row(r))}</ol>
        ))}
    </OverlayThemeRoot>
  );
}

// ── 최근알림 · 이벤트 ─────────────────────────────────────────────────────────

const nickColor = (l: WidgetFeedLine) => RECENT_PLATFORMS.find((p) => p.key === l.platform)?.color ?? OWN_COLOR;

function FeedLine({ l, colored, background, cardLine, motion, leave, durationSec }: { l: WidgetFeedLine; colored: boolean; background: boolean; cardLine: boolean; motion: string; leave?: string; durationSec: number }) {
  return (
    <li className={`${ov.enter} ${v.line} ${cardLine ? `${ov.card} ${v.lineCard}` : ""}`} data-motion={motion} data-leave={leave} style={{ animationDuration: `${durationSec}s` }}>
      {(l.kind === "TEST" || l.platform) && <span className={`${ov.chip} ${v.lineTag}`}>{l.kind === "TEST" ? "테스트" : PLATFORM_LABEL[l.platform!]}</span>}
      {l.before}
      <b className={background ? v.nickBg : undefined} data-colored={colored || undefined} style={colored ? ({ "--nick": nickColor(l) } as CSSProperties) : undefined}>
        {l.nickname}
      </b>
      {l.after}
    </li>
  );
}

export function RecentView({ settings: s, lines, theme }: { settings: RecentSettings; lines: WidgetFeedLine[]; theme: ResolvedTheme }) {
  const motion = motionForEffect(s.effect);
  return (
    <OverlayThemeRoot theme={theme} as="ul" className={`${v.pad} ${v.feed} ${s.card ? "" : ov.onStream}`} style={{ ...font(s.font, { color: !s.card, outline: !s.card && s.textOutline }), gap: s.lineGap }}>
      {lines.map((l) => (
        <FeedLine key={l.id} l={l} colored={s.nicknameColor} background={false} cardLine={s.card} motion={motion} durationSec={s.scrollSpeedSec} />
      ))}
    </OverlayThemeRoot>
  );
}

/** 이벤트: `now` = server time; lines older than 감추기 시간 leave (null = nothing hides, the preview). */
export function EventView({ settings: s, lines, theme, now }: { settings: EventSettings; lines: WidgetFeedLine[]; theme: ResolvedTheme; now: number | null }) {
  const age = (l: WidgetFeedLine) => (now === null || !s.autoHide ? 0 : now - new Date(l.at).getTime());
  const visible = lines.filter((l) => age(l) < s.hideAfterSec * 1000 + 600);
  if (visible.length === 0) return null;
  const motion = motionForEffect(s.effect);
  const leave = leaveForEffect(s.effect);
  const plain = s.style === "BASIC";
  return (
    <OverlayThemeRoot
      theme={theme}
      as="ul"
      className={`${v.pad} ${v.feed} ${plain ? ov.onStream : ""} ${s.style === "LIST" ? `${ov.card} ${v.list}` : ""}`}
      data-event={s.style}
      style={font(s.font, { color: plain })}
    >
      {visible.map((l) => (
        <FeedLine
          key={l.id}
          l={l}
          colored={s.nicknameColor}
          background={s.nicknameBackground}
          cardLine={s.style === "BOX"}
          motion={motion}
          leave={age(l) >= s.hideAfterSec * 1000 ? leave : undefined}
          durationSec={0.5}
        />
      ))}
    </OverlayThemeRoot>
  );
}

// ── 후원 QR코드 ───────────────────────────────────────────────────────────────

export function QrView({ settings: s, imageUrl, theme, size = 200 }: { settings: QrSettings; imageUrl: string; theme: ResolvedTheme; size?: number }) {
  const caption = s.captionEnabled && s.caption.trim() && (
    <span className={`${ov.chip} ${ov.chipAccent} ${v.qrCaption}`} style={{ fontFamily: `"${s.captionFont.family}", var(--ov-body-font)`, fontSize: s.captionFont.size }}>
      {s.caption}
    </span>
  );
  return (
    <OverlayThemeRoot theme={theme} className={`${v.pad} ${v.qr}`}>
      {s.captionPosition === "TOP" && caption}
      <span className={v.qrTile} style={{ borderColor: s.borderColor, borderRadius: QR_RADIUS[s.codeStyle] === 999 ? 999 : Math.round((QR_RADIUS[s.codeStyle] * size) / 200) }}>
        <Image src={imageUrl} alt="후원 QR코드" width={size} height={size} priority />
        {s.centerLogo && (
          <span className={v.qrLogo} aria-hidden="true" style={{ background: s.borderColor }}>
            S
          </span>
        )}
      </span>
      {s.captionPosition === "BOTTOM" && caption}
    </OverlayThemeRoot>
  );
}
