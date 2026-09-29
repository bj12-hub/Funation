"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { advance, enqueueAlert, mockAlerts } from "./alertCore";
import {
  ALERT_DISPLAY_SEC,
  ALERT_MIN_FN_MAX,
  TEST_AMOUNT_MAX,
  TEST_DONOR_MAX,
  TEST_MESSAGE_MAX,
  type OverlayAlert,
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
      .reverse()
  };
}

/** 테스트 후원: display-only (no FN moves). `requestId` makes a double click enqueue once. */
export async function sendTestAlert(input: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "요청을 확인해 주세요." };
  if (mockAlerts.testRequests[v.requestId]) return { status: "SAVED" };
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
  for (const k of ["alertVolume", "ttsVolume"] as const) {
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

/** 현재 알림 건너뛰기. Skipping when nothing is on screen is a no-op. */
export async function skipCurrentAlert(): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const showing = mockAlerts.items.find((a) => a.status === "SHOWING");
  if (showing) {
    showing.status = "SKIPPED";
    mockAlerts.shownAt = null;
  }
  advance();
  return { status: "SAVED" };
}

/** 전체 알림 취소: the one on screen and everything queued. */
export async function cancelAllAlerts(): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  for (const a of mockAlerts.items) if (a.status === "QUEUED" || a.status === "SHOWING") a.status = "SKIPPED";
  mockAlerts.shownAt = null;
  return { status: "SAVED" };
}

/** 다시 보내기: queues a copy of a finished alert (shown again, not charged again). */
export async function replayAlert(id: unknown): Promise<RemoteResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const src = mockAlerts.items.find((a) => a.id === id);
  if (!src || src.status === "QUEUED" || src.status === "SHOWING") return { status: "INVALID", message: "다시 보낼 수 없는 알림이에요." };
  const copy = { ...src, id: `al-${Date.now()}-${mockAlerts.items.length}`, createdAt: new Date().toISOString(), status: "QUEUED" as const };
  mockAlerts.items.push(copy);
  advance();
  return { status: "SAVED" };
}

/** OBS overlay read — no login; the integration key is the secret. */
export async function getOverlayAlert(key: unknown): Promise<OverlayAlert | "FORBIDDEN"> {
  assertMock();
  if (typeof key !== "string" || key !== mockCreator.integrationKey) return "FORBIDDEN";
  advance();
  const { muted, alertVolume, ttsVolume, displaySec } = mockAlerts.controls;
  const showing = mockAlerts.items.find((a) => a.status === "SHOWING");
  return {
    alert: showing && mockAlerts.shownAt !== null ? { ...showing, endsAt: new Date(mockAlerts.shownAt + displaySec * 1000).toISOString() } : null,
    controls: { muted, alertVolume, ttsVolume }
  };
}
