"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { addFeedEntry, liveBroadcastOf, matchMember } from "./crewCore";
import { KEYWORDS_PER_MEMBER, KEYWORD_MAX, SIM_AMOUNT_MAX, SIM_TEXT_MAX, type BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 후원 리스트 Server Actions — code-first (no Figma frame), part of `/creator/crew/broadcast`.
 * Reference: funnation 엑셀콘 v3 (docs/research/funnation-reference.md §3).
 *
 * Donations during a live broadcast land in the 후원 리스트 and are scored for a member by keyword
 * (AUTO) or after the operator confirms (CONFIRM). 한방 collects a window of donations and gives the
 * pot to one member. Scores are display points — no FN moves here. TBD: 직급 배수, 배틀 배수,
 * prize mapping, external donation sources (투네이션 · 계좌).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew feed API is not connected yet.");
};
const bad = (s: string) => MOCK_FORBIDDEN_WORDS.some((w) => s.toLowerCase().includes(w));
const members = () => mockCrew.crews[STUDIO_CHANNEL] ?? [];
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;

/** Keywords are kept per member across broadcasts; a keyword may belong to one member only. */
export async function setMemberKeywords(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  if (!members().some((m) => m.id === v.memberId)) return { status: "INVALID", message: "멤버를 찾을 수 없어요." };
  if (!Array.isArray(v.keywords)) return { status: "INVALID", message: "키워드를 확인해 주세요." };
  const words = [...new Set(v.keywords.map((k) => (typeof k === "string" ? k.trim() : "")).filter(Boolean))];
  if (words.length > KEYWORDS_PER_MEMBER || words.some((k) => k.length > KEYWORD_MAX)) {
    return { status: "INVALID", message: `키워드는 멤버당 ${KEYWORDS_PER_MEMBER}개, 각 ${KEYWORD_MAX}자까지예요.` };
  }
  if (words.some(bad)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const keywords = (mockCrew.keywords ??= {});
  const taken = Object.entries(keywords)
    .filter(([id]) => id !== v.memberId)
    .flatMap(([, ks]) => ks.map((k) => k.toLowerCase()));
  const clash = words.find((k) => taken.includes(k.toLowerCase()));
  if (clash) return { status: "INVALID", message: `'${clash}'는 다른 멤버가 쓰는 키워드예요.` };
  keywords[v.memberId as string] = words;
  return { status: "SAVED" };
}

export async function setAssignMode(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (v.mode !== "AUTO" && v.mode !== "CONFIRM") return { status: "INVALID", message: "반영 방식을 확인해 주세요." };
  live.assignMode = v.mode;
  return { status: "SAVED" };
}

/** 시뮬 후원: a practice entry for the 후원 리스트 (points only, no FN). Deduped by `requestId`. */
export async function simulateDonation(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const seen = (live.simRequests ??= []);
  if (seen.includes(v.requestId)) return { status: "SAVED" };
  const amount = v.fnAmount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > SIM_AMOUNT_MAX) return { status: "INVALID", message: "금액을 확인해 주세요." };
  const donor = (typeof v.donor === "string" ? v.donor.trim() : "") || "시뮬 후원자";
  const message = typeof v.message === "string" ? v.message.trim() : "";
  if (donor.length > SIM_TEXT_MAX || message.length > SIM_TEXT_MAX) return { status: "INVALID", message: `후원자명과 메시지는 ${SIM_TEXT_MAX}자까지예요.` };
  if (bad(donor) || bad(message)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  seen.push(v.requestId);
  addFeedEntry(live, { donor, message, fnAmount: amount, source: "SIM" });
  await mockDelay(100);
  return { status: "SAVED" };
}

/** Assign (or un-assign with `memberId: null`) an entry; confirms PENDING entries. Idempotent. */
export async function assignFeedEntry(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const entry = (live.feed ?? []).find((f) => f.id === v.entryId);
  if (!entry) return { status: "INVALID", message: "후원 기록을 찾을 수 없어요." };
  if (entry.status === "POT") return { status: "INVALID", message: "한방에 모이는 중인 후원이에요. 한방을 먼저 끝내 주세요." };
  if (v.memberId === null) {
    Object.assign(entry, { status: "UNMATCHED", memberId: null });
    return { status: "SAVED" };
  }
  if (!members().some((m) => m.id === v.memberId && m.active)) return { status: "INVALID", message: "활동 중인 멤버를 골라 주세요." };
  Object.assign(entry, { status: "ASSIGNED", memberId: v.memberId });
  return { status: "SAVED" };
}

/** 취소 건: excluded from scores (restore with assign). */
export async function cancelFeedEntry(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const entry = (live.feed ?? []).find((f) => f.id === v.entryId);
  if (!entry) return { status: "INVALID", message: "후원 기록을 찾을 수 없어요." };
  if (entry.status === "POT") return { status: "INVALID", message: "한방에 모이는 중인 후원이에요." };
  Object.assign(entry, { status: "CANCELLED", memberId: null, oneshot: false });
  return { status: "SAVED" };
}

export async function startOneshot(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== rec(input).broadcastId) return notLive;
  live.oneshot ??= { startedAt: new Date().toISOString() };
  return { status: "SAVED" };
}

/**
 * STOP: gives the pot to `memberId` as 한방 entries, or with `memberId: null` returns the pot to
 * normal keyword matching. Stopping when no 한방 is open is a no-op (double click safe).
 */
export async function stopOneshot(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (!live.oneshot) return { status: "SAVED" };
  if (v.memberId !== null && !members().some((m) => m.id === v.memberId && m.active)) return { status: "INVALID", message: "몰아줄 멤버를 골라 주세요." };
  const mode = live.assignMode ?? "AUTO";
  for (const f of live.feed ?? []) {
    if (f.status !== "POT") continue;
    if (v.memberId !== null) Object.assign(f, { status: "ASSIGNED", memberId: v.memberId, oneshot: true });
    else {
      const suggested = matchMember(STUDIO_CHANNEL, f.message);
      Object.assign(f, {
        oneshot: false,
        suggestedMemberId: suggested,
        memberId: suggested && mode === "AUTO" ? suggested : null,
        status: suggested ? (mode === "AUTO" ? "ASSIGNED" : "PENDING") : "UNMATCHED"
      });
    }
  }
  live.oneshot = null;
  return { status: "SAVED" };
}
