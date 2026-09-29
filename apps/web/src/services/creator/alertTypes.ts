import { formatNumber } from "@/lib/format";

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
  message: string;
  fnAmount: number;
  /** Set for EXTERNAL alerts, e.g. "₩5,000" (the FN exchange rate is TBD, so no conversion). */
  amountLabel?: string;
  typeLabel: string;
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
};

export type OverlayAlert = {
  alert: (AlertItem & { endsAt: string }) | null;
  controls: Pick<AlertControls, "muted" | "alertVolume" | "ttsVolume">;
  ttsSkipSeq: number;
  reloadSeq: number;
};

export type RemoteResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** How an alert's amount reads on screen. */
export const alertAmount = (a: { fnAmount: number; amountLabel?: string }) => a.amountLabel ?? `${formatNumber(a.fnAmount)} FN`;
