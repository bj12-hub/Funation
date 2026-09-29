import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
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
};

const g = globalThis as typeof globalThis & { __funationMockAlertsV1?: MockAlerts };
export const mockAlerts = (g.__funationMockAlertsV1 ??= {
  items: [],
  controls: { paused: false, muted: false, minFn: 0, alertVolume: 50, ttsVolume: 80, displaySec: 8 },
  shownAt: null,
  testRequests: {}
});

export function enqueueAlert(input: { kind: AlertKind; donor: string; message: string; fnAmount: number; typeLabel: string }, now = Date.now()) {
  const filtered = input.fnAmount < mockAlerts.controls.minFn;
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
  enqueueAlert({ kind: "DONATION", ...input });
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
