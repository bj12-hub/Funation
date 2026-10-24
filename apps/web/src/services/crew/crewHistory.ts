"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { contributionLines } from "./crewHistoryCore";
import type { ContributionResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 기여도 내역 Server Action — code-first (no Figma frame; StreamDonate 참고), part of `/creator/crew/broadcast`. Read on
 * demand (not with the 3-second board refresh): every score line of one of the channel's broadcasts, live or ended.
 * Studio only — it names donors and 보정 사유.
 */
export async function getContributionHistory(input: unknown): Promise<ContributionResult> {
  if (!USE_MOCK) throw new Error("Crew contribution history API is not connected yet.");
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const b = (mockCrew.broadcasts ?? []).find((x) => x.id === v.broadcastId && x.channelId === STUDIO_CHANNEL);
  if (!b) return { status: "INVALID", message: "방송을 찾을 수 없어요." };
  return { status: "OK", history: { broadcastId: b.id, title: b.title, lines: contributionLines(b) } };
}
