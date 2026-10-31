"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { liveBroadcastOf } from "./crewCore";
import { parseCumulative } from "./crewCumulativeCore";
import type { BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 누적 기여도 Server Actions — code-first (no Figma frame; StreamDonate 누적 기여도 참고), part of `/creator/crew/broadcast`.
 * Settings are kept per channel; OBS에 표시 (`?cumulative`) belongs to the live broadcast. Scores are display points only.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew cumulative board API is not connected yet.");
};

/** Replaces the settings (제목 · 멤버 수 · 표시 · 배치). Saving the same value again is a no-op. */
export async function saveCumulative(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseCumulative(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.cumulatives ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}

/** OBS에 표시 / 숨기기. Setting the same value again is a no-op. */
export async function setCumulativeVisible(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const live = liveBroadcastOf(STUDIO_CHANNEL);
  if (!live || live.id !== v.broadcastId) return { status: "INVALID", message: "진행 중인 방송이 아니에요." };
  if (typeof v.on !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  (live.cumulative ??= { visible: false }).visible = v.on;
  return { status: "SAVED" };
}
