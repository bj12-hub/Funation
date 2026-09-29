"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf } from "./crewCore";
import { SUB_BOARD_MAX, SUB_BOARD_TITLE_MAX, type BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL } from "./mockCrewStore";

/**
 * 서브 점수판 Server Actions — code-first (no Figma frame; funnation 엑셀콘 v3 reference). Boards live
 * inside one broadcast; each scores the FN members received while it is open. One board is open at a
 * time; closing freezes its window. OBS: main scoreboard URL + `?board=번호`. TBD: 판별 상금, 배수.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew boards API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const notLive = { status: "INVALID", message: "진행 중인 방송이 아니에요." } as const;

/** 새 판: closes the open board (if any) and opens the next one. Deduped by `requestId`. */
export async function openSubBoard(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const boards = (live.subBoards ??= []);
  if (boards.some((b) => b.requestId === v.requestId)) return { status: "SAVED" };
  if (boards.length >= SUB_BOARD_MAX) return { status: "INVALID", message: `서브 점수판은 방송당 ${SUB_BOARD_MAX}개까지예요.` };
  const title = (typeof v.title === "string" ? v.title.trim() : "") || `서브 ${boards.length + 1}판`;
  if (title.length > SUB_BOARD_TITLE_MAX) return { status: "INVALID", message: `판 이름은 ${SUB_BOARD_TITLE_MAX}자 이내로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => title.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const now = new Date().toISOString();
  for (const b of boards) if (!b.closedAt) b.closedAt = now;
  boards.push({ no: boards.length + 1, title, openedAt: now, closedAt: null, requestId: v.requestId });
  return { status: "SAVED" };
}

/** 판 마감: freezes the board's window. Closing a closed board is a no-op. */
export async function closeSubBoard(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = rec(input);
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return notLive;
  const board = (live.subBoards ?? []).find((b) => b.no === v.no);
  if (!board) return { status: "INVALID", message: "점수판을 찾을 수 없어요." };
  board.closedAt ??= new Date().toISOString();
  return { status: "SAVED" };
}
