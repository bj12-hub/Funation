"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { channelRows, mockGacha, stageOf, statusOf } from "@/services/donations/gachaCore";
import type { GachaControlResult, GachaRemoteView } from "@/services/donations/gachaTypes";

/**
 * 리모컨 뽑기 (code-first, 펀페이 1009:6549 실행 대기 · 1009:6768 결과 확인): draws play in order on their own;
 * ✓ 완료 takes a shown result off the screen and 수령 처리 marks a prize as handed over. Prizes are drawn
 * at payment and never changed here. TBD: delivery details, audit of 수령 처리.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Gacha remote API is not connected yet.");
};

const studioDraw = (id: unknown) => mockGacha.draws.find((d) => d.channelId === STUDIO_CHANNEL && d.id === id) ?? null;

export async function getGachaRemote(): Promise<GachaRemoteView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return { stage: stageOf(STUDIO_CHANNEL), ...channelRows(STUDIO_CHANNEL) };
}

/** ✓ 완료: a shown result leaves the 뽑기 overlay now (the next draw can start). */
export async function finishGachaDraw(input: unknown): Promise<GachaControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const draw = studioDraw((input as { drawId?: unknown } | null)?.drawId);
  if (!draw) return { status: "INVALID", message: "뽑기 요청을 찾을 수 없어요." };
  const status = statusOf(draw);
  if (status === "DONE") return { status: "SAVED" };
  if (status !== "RESULT") return { status: "INVALID", message: "결과가 나온 뒤 완료할 수 있어요." };
  draw.doneAt = new Date().toISOString();
  return { status: "SAVED" };
}

/** 수령 처리: whether a revealed prize was handed over (a 꽝 has nothing to hand over). */
export async function setGachaClaimed(input: unknown): Promise<GachaControlResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as { drawId?: unknown; claimed?: unknown };
  const draw = studioDraw(v.drawId);
  if (!draw || typeof v.claimed !== "boolean") return { status: "INVALID", message: "요청 정보를 확인해 주세요." };
  const status = statusOf(draw);
  if (draw.blank || (status !== "RESULT" && status !== "DONE")) return { status: "INVALID", message: "수령 처리할 상품이 없어요." };
  draw.claimed = v.claimed;
  return { status: "SAVED" };
}
