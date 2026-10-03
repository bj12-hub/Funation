import { formatNumber } from "@/lib/format";
import type { Platform } from "@/types/platform";

/**
 * 후원 알림 대기열 + 리모컨 — code-first, no Figma frame (docs/figma/code-first-screens.md).
 * Reference: docs/research/funnation-reference.md §3 (리모컨). The server owns the queue: the OBS
 * overlay only shows what the server says is on screen, so a reload never replays or skips alerts.
 * Test alerts are display-only — they never touch FN balances, ledgers or earnings.
 */

/** EXTERNAL = a donation made on a broadcast platform (후원 연동); shown in its own currency, never converted to FN. */
export type AlertKind = "DONATION" | "TEST" | "EXTERNAL";
/** QUEUED → SHOWING → DONE; SKIPPED (리모컨) and FILTERED (below the minimum) are never shown. */
export type AlertStatus = "QUEUED" | "SHOWING" | "DONE" | "SKIPPED" | "FILTERED";

export type AlertItem = {
  id: string;
  kind: AlertKind;
  donor: string;
  /** 등급·칭호 labels resolved on the server when the donation completed (DONATION only). */
  badges?: string[];
  message: string;
  fnAmount: number;
  /** Set for EXTERNAL alerts, e.g. "₩5,000" (the FN exchange rate is TBD, so no conversion). */
  amountLabel?: string;
  typeLabel: string;
  /** Broadcast platform an EXTERNAL alert came from (통합 후원 알림 shows its mark). */
  platform?: Platform;
  createdAt: string;
  status: AlertStatus;
};

export type AlertControls = {
  paused: boolean;
  muted: boolean;
  /** Alerts below this FN amount are recorded but not shown. 0 = show all. */
  minFn: number;
  /** 0–100 */
  alertVolume: number;
  ttsVolume: number;
  /** Seconds an alert stays on screen. Default is a placeholder (TBD). */
  displaySec: number;
};

export const ALERT_DISPLAY_SEC = { min: 3, max: 30 } as const;
export const ALERT_MIN_FN_MAX = 10_000_000;
export const TEST_DONOR_MAX = 20;
export const TEST_MESSAGE_MAX = 100;
export const TEST_AMOUNT_PRESETS = [1_000, 5_000, 10_000, 50_000, 100_000] as const;
export const TEST_AMOUNT_MAX = 10_000_000;

export type RemoteView = {
  controls: AlertControls;
  showing: AlertItem | null;
  queued: AlertItem[];
  /** Newest first, excluding queued. */
  recent: AlertItem[];
  /** 기능 제어: ON/OFF per overlay and the video donation volume (alert volumes live in `controls`). */
  overlays: { on: Record<OverlayTarget, boolean>; videoVolume: number };
};

export type OverlayAlert = {
  alert: (AlertItem & { endsAt: string }) | null;
  controls: Pick<AlertControls, "muted" | "alertVolume" | "ttsVolume">;
  ttsSkipSeq: number;
  reloadSeq: number;
  /** 기능 제어 ON/OFF: false = the overlay shows (and speaks) nothing. */
  on: boolean;
};

export type RemoteResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** 기능별 새로고침: each OBS overlay can be reloaded on its own (or all at once). */
export const OVERLAY_TARGETS = [
  { key: "alert", label: "후원 알림" },
  { key: "effects", label: "이펙트 · 효과" },
  { key: "video", label: "영상 후원" },
  { key: "drawing", label: "그림 후원" },
  { key: "banner", label: "배너" },
  { key: "subtitle", label: "자막" },
  { key: "marquee", label: "전광판" },
  { key: "timer", label: "타이머" },
  { key: "credits", label: "엔딩 크레딧" },
  { key: "chat", label: "통합 채팅" },
  { key: "crew", label: "크루 점수판 · 배틀 · 강탈 · 시나리오" }
] as const;
export type OverlayTarget = (typeof OVERLAY_TARGETS)[number]["key"];
export const isOverlayTarget = (v: unknown): v is OverlayTarget => OVERLAY_TARGETS.some((t) => t.key === v);

/** The overlays among `targets` (default: all) switched OFF in 기능 제어, in 기능 제어 order. */
export const offOverlayTargets = (switches: Record<OverlayTarget, boolean>, targets?: readonly OverlayTarget[]) =>
  OVERLAY_TARGETS.filter((t) => (!targets || targets.includes(t.key)) && !switches[t.key]);

/** What every overlay reads besides its own data: 기능별 새로고침 and 기능 제어 ON/OFF. */
export type OverlaySignal = { reloadSeq: number; on: boolean };

/** How an alert's amount reads on screen. */
export const alertAmount = (a: { fnAmount: number; amountLabel?: string }) => a.amountLabel ?? `${formatNumber(a.fnAmount)} FN`;
