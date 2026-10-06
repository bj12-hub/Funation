"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession, getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { FAN_NOTE_KINDS, FAN_NOTE_LIMITS, type BroadcastResult, type FanNoteResult, type FanNoteStatus, type RoomFanNotes } from "./crewTypes";
import { liveBroadcastOf, roomFanNotes } from "./crewCore";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 팬 메시지 · 요청사항 — code-first (funnation 엑셀방송, 2026-10-06 결정). While a channel's crew broadcast is live,
 * signed-in viewers send a free note (팬 메시지 or 요청사항, to one member or the whole crew) from the channel room;
 * the operator reads them in `/creator/crew/broadcast` and marks them 완료 or hides them. One note per viewer every
 * FAN_NOTE_LIMITS.cooldownSec (TBD: 도배 정책); a repeated `requestId` returns the first result.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew fan notes API is not connected yet.");
};

const STATUSES: FanNoteStatus[] = ["NEW", "DONE", "HIDDEN"];
const isKind = (v: unknown): v is (typeof FAN_NOTE_KINDS)[number]["key"] => FAN_NOTE_KINDS.some((k) => k.key === v);
const obj = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/** Public: the room card for `channelId`, or null when no crew broadcast is live there or 받기 is off. */
export async function getRoomFanNotes(channelId: unknown): Promise<RoomFanNotes | null> {
  assertMock();
  if (typeof channelId !== "string") return null;
  const live = liveBroadcastOf(channelId);
  if (!live || live.fanNotesClosed) return null;
  const session = await getSession();
  return roomFanNotes(live, session?.userId ?? null);
}

export async function sendFanNote(input: unknown): Promise<FanNoteResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  if (typeof v.channelId !== "string") return { status: "CLOSED" };
  await mockDelay(150);
  const live = liveBroadcastOf(v.channelId);
  if (!live || live.fanNotesClosed || live.id !== v.broadcastId) return { status: "CLOSED" };
  const notes = (live.fanNotes ??= []);
  if (notes.some((n) => n.requestId === v.requestId && n.userId === session.userId)) return { status: "SENT", room: roomFanNotes(live, session.userId) };

  if (!isKind(v.kind)) return { status: "INVALID", message: "보낼 종류를 골라 주세요." };
  const memberId = v.memberId ?? null;
  if (memberId !== null && !(mockCrew.crews[v.channelId] ?? []).some((m) => m.active && m.id === memberId)) return { status: "INVALID", message: "받는 멤버를 다시 골라 주세요." };
  const text = typeof v.text === "string" ? v.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > FAN_NOTE_LIMITS.textMax) return { status: "INVALID", message: `내용을 1~${FAN_NOTE_LIMITS.textMax}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => text.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const cooldown = roomFanNotes(live, session.userId).cooldownLeft;
  if (cooldown > 0) return { status: "COOLDOWN", seconds: cooldown };
  if (notes.length >= FAN_NOTE_LIMITS.perBroadcast) return { status: "INVALID", message: "이번 방송에 받을 수 있는 메시지가 모두 찼어요." };

  notes.push({
    id: `fn-${Date.now().toString(36)}-${notes.length}`,
    at: new Date().toISOString(),
    userId: session.userId,
    author: session.nickname,
    kind: v.kind,
    memberId: memberId as string | null,
    text,
    status: "NEW",
    requestId: v.requestId
  });
  return { status: "SENT", room: roomFanNotes(live, session.userId) };
}

/** The studio's live broadcast if `broadcastId` is it (operator actions). */
async function operatorLive(broadcastId: unknown) {
  if (!(await getCreatorSession())) return "UNAUTHORIZED" as const;
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  return live && live.id === broadcastId ? live : null;
}

const TEST_NOTES = { MESSAGE: "오늘 방송도 응원해요! (테스트)", REQUEST: "신청곡 하나 불러 주세요 (테스트)" } as const;

/** 테스트 팬 메시지 · 요청사항: a sample note from "테스트 시청자", to preview the list (no cooldown; deduped by request id). */
export async function simulateFanNote(input: unknown): Promise<BroadcastResult> {
  assertMock();
  const v = obj(input);
  const live = await operatorLive(v.broadcastId);
  if (live === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
  if (!live) return { status: "INVALID", message: "진행 중인 방송이 아니에요." };
  if (!isKind(v.kind) || typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const notes = (live.fanNotes ??= []);
  if (notes.some((n) => n.requestId === v.requestId)) return { status: "SAVED" };
  if (notes.length >= FAN_NOTE_LIMITS.perBroadcast) return { status: "INVALID", message: "이번 방송에 받을 수 있는 메시지가 모두 찼어요." };
  notes.push({ id: `fn-${Date.now().toString(36)}-${notes.length}`, at: new Date().toISOString(), userId: "test-viewer", author: "테스트 시청자", kind: v.kind, memberId: null, text: TEST_NOTES[v.kind], status: "NEW", requestId: v.requestId });
  return { status: "SAVED" };
}

/** 완료 · 숨기기 · 되돌리기 (NEW). */
export async function setFanNoteStatus(input: unknown): Promise<BroadcastResult> {
  assertMock();
  const v = obj(input);
  const live = await operatorLive(v.broadcastId);
  if (live === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
  if (!live) return { status: "INVALID", message: "진행 중인 방송이 아니에요." };
  const note = (live.fanNotes ?? []).find((n) => n.id === v.id);
  if (!note) return { status: "INVALID", message: "메시지를 찾을 수 없어요." };
  if (!STATUSES.includes(v.status as FanNoteStatus)) return { status: "INVALID", message: "처리 상태를 확인해 주세요." };
  note.status = v.status as FanNoteStatus;
  return { status: "SAVED" };
}

/** 팬 메시지 받기 켜기 / 끄기 (the room card disappears while off; notes already sent stay). */
export async function setFanNotesOpen(input: unknown): Promise<BroadcastResult> {
  assertMock();
  const v = obj(input);
  const live = await operatorLive(v.broadcastId);
  if (live === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
  if (!live) return { status: "INVALID", message: "진행 중인 방송이 아니에요." };
  if (typeof v.on !== "boolean") return { status: "INVALID", message: "받기 설정을 확인해 주세요." };
  live.fanNotesClosed = !v.on;
  return { status: "SAVED" };
}
