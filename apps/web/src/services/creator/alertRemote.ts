"use server";

import { USE_MOCK } from "@/lib/mock";
import { ownEntry } from "@/lib/records";
import { getCreatorSession } from "@/lib/session";
import { sameSecret } from "@/lib/secret";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { advance, enqueueAlert, isOverlayOn, mockAlerts, overlaySignal } from "./alertCore";
import { ingestDonationLinksThrottled } from "./donationLinkCore";
import { mockMedia } from "./mediaCore";
import {
  ALERT_DISPLAY_SEC,
  ALERT_MIN_FN_MAX,
  TEST_AMOUNT_MAX,
  TEST_DONOR_MAX,
  TEST_MESSAGE_MAX,
  isOverlayTarget,
  OVERLAY_TARGETS,
  type OverlayAlert,
  type OverlaySignal,
  type OverlayTarget,
  type RemoteResult,
  type RemoteView
} from "./alertTypes";
import { mockCreator } from "./mockCreatorStore";

/**
 * 리모컨 Server Actions — code-first (no Figma frame). Route `/creator/remote`, overlay
 * `/overlay/alert/[key]`. TBD: sound/TTS assets and voices, per-type alert styles, audit log.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Alert remote API is not connected yet.");
};
const bad = (s: string) => MOCK_FORBIDDEN_WORDS.some((w) => s.toLowerCase().includes(w));
const RECENT_MAX = 20;

export async function getRemoteView(): Promise<RemoteView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  advance();
  const items = mockAlerts.items;
  return {
    controls: { ...mockAlerts.controls },
    showing: items.find((a) => a.status === "SHOWING") ?? null,
    queued: items.filter((a) => a.status === "QUEUED"),
    recent: items
      .filter((a) => a.status !== "QUEUED" && a.status !== "SHOWING")
      .slice(-RECENT_MAX)
      .reverse(),
    overlays: { on: Object.fromEntries(OVERLAY_TARGETS.map((t) => [t.key, isOverlayOn(t.key)])) as Record<OverlayTarget, boolean>, videoVolume: mockMedia.videoSettings.volume }
  };
}

/** 테스트 후원: display-only (no FN moves). `requestId` makes a double click enqueue once. */
export async function sendTestAlert(input: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "요청을 확인해 주세요." };
  if (ownEntry(mockAlerts.testRequests, v.requestId)) return { status: "SAVED" };
  const amount = v.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > TEST_AMOUNT_MAX) {
    return { status: "INVALID", message: "금액은 1 ~ 10,000,000 FN으로 입력해 주세요." };
  }
  const donor = (typeof v.donor === "string" ? v.donor.trim() : "") || "테스트 후원자";
  const message = typeof v.message === "string" ? v.message.trim() : "";
  if (donor.length > TEST_DONOR_MAX || message.length > TEST_MESSAGE_MAX) return { status: "INVALID", message: "후원자명 또는 메시지가 너무 길어요." };
  if (bad(donor) || bad(message)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const item = enqueueAlert({ kind: "TEST", donor, message, fnAmount: amount, typeLabel: "테스트 후원" });
  mockAlerts.testRequests[v.requestId] = item.id;
  return { status: "SAVED" };
}

export async function setAlertControls(input: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const c = mockAlerts.controls;
  const next = { ...c };
  const vol = (x: unknown) => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 100;
  for (const k of ["paused", "muted"] as const) {
    if (k in v) {
      if (typeof v[k] !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
      next[k] = v[k] as boolean;
    }
  }
  for (const k of ["alertVolume", "ttsVolume", "signatureVolume"] as const) {
    if (k in v) {
      if (!vol(v[k])) return { status: "INVALID", message: "볼륨은 0 ~ 100 사이예요." };
      next[k] = v[k] as number;
    }
  }
  if ("minFn" in v) {
    const m = v.minFn;
    if (typeof m !== "number" || !Number.isInteger(m) || m < 0 || m > ALERT_MIN_FN_MAX) return { status: "INVALID", message: "최소 금액을 확인해 주세요." };
    next.minFn = m;
  }
  if ("displaySec" in v) {
    const d = v.displaySec;
    if (typeof d !== "number" || !Number.isInteger(d) || d < ALERT_DISPLAY_SEC.min || d > ALERT_DISPLAY_SEC.max) {
      return { status: "INVALID", message: `표시 시간은 ${ALERT_DISPLAY_SEC.min} ~ ${ALERT_DISPLAY_SEC.max}초예요.` };
    }
    next.displaySec = d;
  }
  mockAlerts.controls = next;
  advance();
  return { status: "SAVED" };
}

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/**
 * 현재 알림 건너뛰기 of the alert the remote showed (`alertId`). A no-op unless that alert is still on screen: when
 * it already ended, the click must not skip the next (paid) alert.
 */
export async function skipCurrentAlert(input: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const alertId = rec(input).alertId;
  if (typeof alertId !== "string") return { status: "INVALID", message: "요청을 확인해 주세요." };
  advance();
  const showing = mockAlerts.items.find((a) => a.status === "SHOWING");
  if (showing?.id === alertId) {
    showing.status = "SKIPPED";
    mockAlerts.shownAt = null;
    advance();
  }
  return { status: "SAVED" };
}

/**
 * 전체 알림 취소: the one on screen and everything queued. With `upToId` (the newest alert the remote listed) only
 * alerts up to it are cancelled — one that arrived after the operator looked keeps its place in the queue.
 */
export async function cancelAllAlerts(input?: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const upToId = rec(input).upToId;
  // Items are kept in arrival order (the queue order), so "seen" = at or before the remote's newest alert.
  const last = upToId === undefined ? mockAlerts.items.length - 1 : mockAlerts.items.findIndex((a) => a.id === upToId);
  if (last < 0 && upToId !== undefined) return { status: "INVALID", message: "알림 목록이 바뀌었어요. 새로고침 후 다시 시도해 주세요." };
  mockAlerts.items.forEach((a, i) => {
    if (i > last || (a.status !== "QUEUED" && a.status !== "SHOWING")) return;
    if (a.status === "SHOWING") mockAlerts.shownAt = null;
    a.status = "SKIPPED";
  });
  advance();
  return { status: "SAVED" };
}

/**
 * 다시 보내기: queues a copy of a finished alert (shown again, not charged again). `requestId` (one per intended
 * replay) makes a double click or retry queue one copy.
 */
export async function replayAlert(input: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "요청을 확인해 주세요." };
  const requests = (mockAlerts.replayRequests ??= {});
  if (ownEntry(requests, v.requestId)) return { status: "SAVED" };
  const src = mockAlerts.items.find((a) => a.id === v.id);
  if (!src || src.status === "QUEUED" || src.status === "SHOWING") return { status: "INVALID", message: "다시 보낼 수 없는 알림이에요." };
  const copy = { ...src, id: `al-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), status: "QUEUED" as const, replayOf: src.replayOf ?? src.id };
  mockAlerts.items.push(copy);
  requests[v.requestId] = copy.id;
  advance();
  return { status: "SAVED" };
}

/** TTS 스킵: stops the speech on screen now (the alert itself keeps showing). */
export async function skipTts(): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  mockAlerts.ttsSkipSeq += 1;
  return { status: "SAVED" };
}

/**
 * 오버레이 새로고침: with `{ target }` only that overlay reloads (기능별 새로고침); without it every open
 * overlay reloads on its next poll.
 */
export async function reloadOverlays(input?: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const target = (typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {}).target;
  if (target === undefined) mockAlerts.reloadSeq += 1;
  else if (isOverlayTarget(target)) {
    const seqs = (mockAlerts.reloadSeqs ??= {});
    seqs[target] = (seqs[target] ?? 0) + 1;
  } else return { status: "INVALID", message: "새로고침할 오버레이를 확인해 주세요." };
  return { status: "SAVED" };
}

/** Reload + ON/OFF signal for overlays whose data has no room for it (통합 채팅 · 크루 점수판). No login; the key is the secret. */
export async function getOverlaySignal(key: unknown, target: unknown): Promise<OverlaySignal | "FORBIDDEN"> {
  assertMock();
  if (!sameSecret(key, mockCreator.integrationKey) || !isOverlayTarget(target)) return "FORBIDDEN";
  return overlaySignal(target);
}

/**
 * 기능 제어 ON/OFF (위플랩 리모컨처럼): an OFF overlay shows and plays nothing until it is switched back on.
 * Its data keeps moving (an alert shown while 후원 알림 is OFF is not replayed later — use 전체 일시정지 to hold the queue).
 */
export async function setOverlaySwitch(input: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isOverlayTarget(v.target) || typeof v.on !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  const off = (mockAlerts.overlayOff ??= {});
  if (v.on) delete off[v.target];
  else off[v.target] = true;
  return { status: "SAVED" };
}

/** 모두 켜기: every overlay switched OFF in 기능 제어 comes back on. Calling it again changes nothing. */
export async function turnOnAllOverlays(): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  mockAlerts.overlayOff = {};
  return { status: "SAVED" };
}

/** 기능 제어 ON/OFF of every overlay (오버레이 주소 page). */
export async function getOverlaySwitches(): Promise<Record<OverlayTarget, boolean> | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return Object.fromEntries(OVERLAY_TARGETS.map((t) => [t.key, isOverlayOn(t.key)])) as Record<OverlayTarget, boolean>;
}

/** 볼륨 제어: the video donation player's volume (same value as 영상 후원 설정). */
export async function setVideoVolume(input: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const volume = (typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {}).volume;
  if (typeof volume !== "number" || !Number.isInteger(volume) || volume < 0 || volume > 100) return { status: "INVALID", message: "볼륨은 0 ~ 100 사이예요." };
  mockMedia.videoSettings = { ...mockMedia.videoSettings, volume };
  return { status: "SAVED" };
}

/** OBS overlay read — no login; the integration key is the secret. */
export async function getOverlayAlert(key: unknown): Promise<OverlayAlert | "FORBIDDEN"> {
  assertMock();
  if (!sameSecret(key, mockCreator.integrationKey)) return "FORBIDDEN";
  // Platform donations (후원 연동) reach the queue even when the studio screen is closed — throttled, and a
  // platform problem never stops the overlay (it shows on the 후원 연동 row instead).
  try {
    await ingestDonationLinksThrottled();
  } catch {
    // Ignored here on purpose.
  }
  advance();
  const { muted, alertVolume, ttsVolume, signatureVolume, displaySec } = mockAlerts.controls;
  const showing = mockAlerts.items.find((a) => a.status === "SHOWING");
  return {
    alert: showing && mockAlerts.shownAt !== null ? { ...showing, endsAt: new Date(mockAlerts.shownAt + displaySec * 1000).toISOString() } : null,
    controls: { muted, alertVolume, ttsVolume, signatureVolume },
    ttsSkipSeq: mockAlerts.ttsSkipSeq,
    ...overlaySignal("alert")
  };
}
