"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PlatformMark } from "@/features/broadcast/PlatformMark";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { alertAmount, type AlertItem } from "@/services/creator/alertTypes";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { ALERT_TOKENS, type AlertSettings } from "@/services/creator/widgetSettingsTypes";
import c from "./alertCard.module.css";

export type AlertCardData = Pick<AlertItem, "id" | "donor" | "message" | "fnAmount" | "amountLabel" | "typeLabel" | "platform" | "imageUrl" | "badges">;

const COUNT_MS = 900;

/**
 * The amount label with its number counting up from 0 when the card arrives (e.g. "10,000 FN", "₩5,000",
 * "350 별풍선"). Ends on the exact label; reduced motion and labels without a number skip it.
 */
function useCountUp(label: string, enabled: boolean, runKey: string) {
  const match = label.match(/\d[\d,]*/);
  const target = match ? Number(match[0].replaceAll(",", "")) : null;
  const [value, setValue] = useState<number | null>(enabled && target !== null ? 0 : null);
  useEffect(() => {
    if (!enabled || target === null || (typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      setValue(null);
      return;
    }
    setValue(0);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / COUNT_MS);
      setValue(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // A paused page (hidden tab) still lands on the real amount.
    const done = setTimeout(() => setValue(null), COUNT_MS + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [runKey, enabled, target]);
  return value === null || !match ? label : label.replace(match[0], value.toLocaleString("ko-KR"));
}

/** The 알림 문구 with {닉네임} and {금액} drawn as highlighted words. */
function Headline({ template, donor, amount }: { template: string; donor: string; amount: string }) {
  const parts = template.split(/(\{닉네임\}|\{금액\})/);
  return (
    <>
      {parts.map((p, i): ReactNode => {
        if (p === ALERT_TOKENS.donor)
          return (
            <b key={i} className={c.name}>
              {donor}
            </b>
          );
        if (p === ALERT_TOKENS.amount)
          return (
            <b key={i} className={c.inlineAmount}>
              {amount}
            </b>
          );
        return p;
      })}
    </>
  );
}

function Meta({ alert, design }: { alert: AlertCardData; design: AlertSettings }) {
  const badges = design.showBadges ? (alert.badges ?? []) : [];
  if (!design.showPlatform && badges.length === 0) return null;
  return (
    <span className={c.meta}>
      {design.showPlatform && (
        <span className={`${ov.chip} ${c.typeChip}`}>
          {alert.platform && <PlatformMark platform={alert.platform} size="sm" />}
          {alert.typeLabel}
        </span>
      )}
      {badges.map((b) => (
        <span key={b} className={`${ov.chip} ${ov.chipAccent}`}>
          {b}
        </span>
      ))}
    </span>
  );
}

/**
 * 후원 알림 card (code-first, 2026-10-08 오버레이 테마). Drawn by the OBS overlay and, with sample data, by the
 * 후원 알림 settings preview — one component, so the preview is what goes on stream. Layouts: 카드형 · 가로 띠형 ·
 * 이미지 강조형; every theme draws each of them.
 */
export function AlertCard({ alert, design, theme, replay = 0 }: { alert: AlertCardData; design: AlertSettings; theme: ResolvedTheme; replay?: number }) {
  const label = alertAmount(alert);
  const amount = useCountUp(label, design.countUp, `${alert.id}:${replay}`);
  const image = design.showImage ? alert.imageUrl : undefined;
  const bold = theme.theme === "BOLD";
  const message = design.showMessage && alert.message ? alert.message : null;
  const headline = (
    <p className={`${ov.label} ${c.headline}`}>
      <Headline template={design.headline} donor={alert.donor} amount={label} />
    </p>
  );
  const amountEl = <strong className={`${ov.display} ${c.amount}`}>{amount}</strong>;

  let body: ReactNode;
  if (design.layout === "BANNER") {
    body = (
      <div className={`${bold ? ov.accentCard : ov.card} ${ov.pill} ${c.banner}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
          <img src={image} alt="" className={c.bannerImage} />
        ) : (
          <span className={`${ov.avatar} ${c.bannerAvatar}`} aria-hidden="true">
            {[...alert.donor][0] ?? "?"}
          </span>
        )}
        <span className={c.bannerText}>
          {headline}
          {amountEl}
        </span>
        {message && <span className={`${ov.muted} ${c.bannerMessage}`}>{message}</span>}
        <Meta alert={alert} design={design} />
      </div>
    );
  } else if (design.layout === "IMAGE") {
    body = (
      <div className={c.imageWrap}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
          <img src={image} alt="" className={c.hero} />
        ) : (
          <span className={`${ov.accentCard} ${ov.display} ${c.heroFallback}`} aria-hidden="true">
            {amount}
          </span>
        )}
        <div className={`${ov.card} ${c.imageCard}`}>
          <Meta alert={alert} design={design} />
          {headline}
          {image && amountEl}
          {message && <p className={c.message}>{message}</p>}
        </div>
      </div>
    );
  } else {
    body = (
      <div className={`${bold ? ov.accentCard : ov.card} ${c.card}`}>
        <Meta alert={alert} design={design} />
        {image && (
          // eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock)
          <img src={image} alt="" className={c.thumb} />
        )}
        {amountEl}
        {headline}
        {message && <p className={c.message}>{message}</p>}
      </div>
    );
  }

  return (
    <OverlayThemeRoot theme={theme} className={c.stage} data-layout={design.layout}>
      <div key={`${alert.id}:${replay}`} className={`${ov.enter} ${c.motion}`} data-motion={design.motion} role="status">
        {body}
      </div>
    </OverlayThemeRoot>
  );
}
