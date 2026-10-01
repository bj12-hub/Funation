import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import type { Platform } from "@/types/platform";
import { notify } from "@/services/notifications/notificationCore";
import type { AlertControls, AlertItem, AlertKind } from "./alertTypes";

/**
 * Server-only alert queue internals (not a "use server" module): only the Donation Core and the
 * remote actions may enqueue. State lives on `globalThis` like the other mock stores.
 */

type MockAlerts = {
  items: AlertItem[];
  controls: AlertControls;
  /** When the SHOWING alert went on screen. */
  shownAt: number | null;
  /** 테스트 후원 request ids already accepted (double-click / retry dedupe). */
  testRequests: Record<string, string>;
  /** Signals for open overlays: a changed value means "stop speaking" / "reload yourself". */
  ttsSkipSeq: number;
  reloadSeq: number;
};

// V2: overlay signals (ttsSkipSeq, reloadSeq).
const g = globalThis as typeof globalThis & { __funationMockAlertsV2?: MockAlerts };
export const mockAlerts = (g.__funationMockAlertsV2 ??= {
  items: [],
  controls: { paused: false, muted: false, minFn: 0, alertVolume: 50, ttsVolume: 80, displaySec: 8 },
  shownAt: null,
  testRequests: {},
  ttsSkipSeq: 0,
  reloadSeq: 0
});

export function enqueueAlert(input: { kind: AlertKind; donor: string; message: string; fnAmount: number; amountLabel?: string; typeLabel: string; platform?: Platform }, now = Date.now()) {
  // The FN minimum cannot apply to other currencies (no exchange rate — TBD), so external alerts pass.
  const filtered = input.kind !== "EXTERNAL" && input.fnAmount < mockAlerts.controls.minFn;
  const item: AlertItem = {
    id: `al-${now}-${mockAlerts.items.length}`,
    ...input,
    createdAt: new Date(now).toISOString(),
    status: filtered ? "FILTERED" : "QUEUED"
  };
  mockAlerts.items.push(item);
  advance(now);
  return item;
}

/**
 * Called by the Donation Core after a completed donation. Only donations to the studio creator's own
 * channel reach this creator's overlay (TBD: per-creator queues once channels are real).
 */
export function enqueueDonationAlert(creatorId: string, input: { donor: string; message: string; fnAmount: number; typeLabel: string }) {
  if (creatorId !== STUDIO_CHANNEL) return;
  const item = enqueueAlert({ kind: "DONATION", ...input });
  notify({ kind: "DONATION_RECEIVED", title: "새 후원이 들어왔어요", body: `${input.donor}님 · ${input.fnAmount.toLocaleString("ko-KR")} FN`, href: "/creator/donations?tab=list", dedupeKey: `alert:${item.id}` });
}

/** Moves the queue forward: finishes an expired alert and puts the next one on screen. */
export function advance(now = Date.now()) {
  const showing = mockAlerts.items.find((a) => a.status === "SHOWING");
  if (showing && mockAlerts.shownAt !== null && now - mockAlerts.shownAt >= mockAlerts.controls.displaySec * 1000) {
    showing.status = "DONE";
    mockAlerts.shownAt = null;
  } else if (showing) return;
  if (mockAlerts.controls.paused) return;
  const next = mockAlerts.items.find((a) => a.status === "QUEUED");
  if (next) {
    next.status = "SHOWING";
    mockAlerts.shownAt = now;
  }
}
