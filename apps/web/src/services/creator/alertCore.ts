import { createHmac, randomBytes } from "node:crypto";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import type { Platform } from "@/types/platform";
import { notify } from "@/services/notifications/notificationCore";
import type { AlertControls, AlertItem, AlertKind, NativeAmount, OverlaySignal, OverlayTarget } from "./alertTypes";
import { shownOnStream } from "./donationPageCore";

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
  /** 다시 보내기 request ids already applied → the queued copy (double-click / retry dedupe). */
  replayRequests?: Record<string, string>;
  /** Signals for open overlays: a changed value means "stop speaking" / "reload yourself". */
  ttsSkipSeq: number;
  reloadSeq: number;
  /** 기능별 새로고침 counters (added to `reloadSeq`). */
  reloadSeqs?: Partial<Record<OverlayTarget, number>>;
  /** 기능 제어: overlays switched OFF (missing = ON). */
  overlayOff?: Partial<Record<OverlayTarget, boolean>>;
};

/**
 * Past donations already shown on stream (mock): the studio channel receives no room donations in mock
 * mode, so the 후원 위젯 (목표 · 누적 · 랭킹 …) and the 리모컨 history start with these.
 */
function seedHistory(now = Date.now()): AlertItem[] {
  const seeds: [string, number, string, number][] = [
    ["별빛소나타", 50_000, "오늘 방송 최고예요!", 27],
    ["치즈냥", 10_000, "노래 한 곡 부탁드려요", 20],
    ["우주비행사", 30_000, "늘 응원합니다", 14],
    ["익명", 5_000, "", 9],
    ["별빛소나타", 20_000, "또 왔어요 ㅎㅎ", 5],
    ["초코쿠키", 3_000, "화이팅!", 2]
  ];
  return seeds.map(([donor, fnAmount, message, daysAgo], i) => ({
    id: `al-seed-${i + 1}`,
    kind: "DONATION",
    donor,
    message,
    fnAmount,
    typeLabel: "일반 후원",
    createdAt: new Date(now - daysAgo * 86_400_000).toISOString(),
    status: "DONE"
  }));
}

// V4: donation alerts carry `donorKey` (V3 seeded the donation history, V2 added overlay signals).
const g = globalThis as typeof globalThis & { __ssumnationMockAlertsV4?: MockAlerts; __ssumnationDonorKeySecret?: Buffer };
export const mockAlerts = (g.__ssumnationMockAlertsV4 ??= {
  items: seedHistory(),
  controls: { paused: false, muted: false, minFn: 0, alertVolume: 50, ttsVolume: 80, signatureVolume: 80, displaySec: 8 },
  shownAt: null,
  testRequests: {},
  ttsSkipSeq: 0,
  reloadSeq: 0
});
// Stores created before 시그니처 볼륨 (2026-10-06) start at the same default.
mockAlerts.controls.signatureVolume ??= 80;

// Not under __ssumnationMock*: test resets keep it (the real backend keeps a server secret).
const donorKeySecret = () => (g.__ssumnationDonorKeySecret ??= randomBytes(32));

/**
 * The opaque key a donation alert carries for its donor: stable per member and channel, unlinkable across channels,
 * and the member id cannot be read back from it (alert items reach the public overlays).
 */
export const donorKeyOf = (channelId: string, memberId: string) =>
  `dk-${createHmac("sha256", donorKeySecret()).update(`${channelId}\n${memberId}`).digest("base64url").slice(0, 22)}`;

/** The reload signal one overlay watches: 전체 새로고침 + its own 기능별 새로고침. */
export const reloadSeqOf = (target: OverlayTarget) => mockAlerts.reloadSeq + (mockAlerts.reloadSeqs?.[target] ?? 0);
export const isOverlayOn = (target: OverlayTarget) => !mockAlerts.overlayOff?.[target];
/** Reload signal + ON/OFF for one overlay read. */
export const overlaySignal = (target: OverlayTarget): OverlaySignal => ({ reloadSeq: reloadSeqOf(target), on: isOverlayOn(target) });

export function enqueueAlert(
  input: {
    kind: AlertKind;
    donor: string;
    donorKey?: string | null;
    badges?: string[];
    message: string;
    fnAmount: number;
    amountLabel?: string;
    typeLabel: string;
    platform?: Platform;
    imageUrl?: string;
    soundUrl?: string;
    native?: NativeAmount;
    questId?: string;
  },
  now = Date.now()
) {
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
 * channel reach this creator's overlay (TBD: per-creator queues once channels are real). The creator's
 * 대체 메시지 표시 설정 and 후원 필터링 apply to the name and message shown (and spoken) on stream (shownOnStream).
 * A 퀘스트 후원 passes its `questId`: the alert shows when it is sent, but its FN counts in the 후원 위젯 only
 * once the quest succeeds (settleQuestAlerts). The Donation Core always passes `donorKey` (donorKeyOf, or null for a
 * hidden profile).
 */
export function enqueueDonationAlert(
  creatorId: string,
  input: { donor: string; donorKey?: string | null; badges?: string[]; message: string; fnAmount: number; typeLabel: string; imageUrl?: string; soundUrl?: string; questId?: string }
) {
  if (creatorId !== STUDIO_CHANNEL) return;
  const item = enqueueAlert({ kind: "DONATION", ...input, ...shownOnStream(input) });
  notify({ kind: "DONATION_RECEIVED", title: "새 후원이 들어왔어요", body: `${input.donor}님 · ${input.fnAmount.toLocaleString("ko-KR")} FN`, href: "/creator/donations?tab=list", dedupeKey: `alert:${item.id}` });
}

/** A 퀘스트 후원 succeeded: its alerts (and 다시 보내기 copies) now count in 목표 · 누적 · 랭킹. Calling it again changes nothing. */
export function settleQuestAlerts(questId: string, at: string) {
  for (const a of mockAlerts.items) {
    if (a.questId !== questId) continue;
    a.questSucceeded = true;
    a.questSucceededAt = at;
  }
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
