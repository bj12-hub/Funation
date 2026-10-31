"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { sigCountSignatures } from "./crewSigCountCore";
import { parseMinusSettings } from "./crewCore";
import type { BroadcastResult } from "./crewTypes";
import { STUDIO_CHANNEL, mockCrew } from "./mockCrewStore";

/**
 * 마이너스 시그니처 Server Actions — code-first (2026-11-01, policy-decisions 6 (a) as a crew option), part of
 * `/creator/crew/broadcast`. Kept per channel; a donation is fixed as 마이너스 when it comes in (crewCore.isMinusDonation).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Crew minus signature API is not connected yet.");
};

/** Replaces the settings (마이너스 시그니처 · 제외 멤버). Donations already in keep how they counted. */
export async function saveMinusSignatures(input: unknown): Promise<BroadcastResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseMinusSettings(
    input,
    sigCountSignatures().map((s) => s.id),
    (mockCrew.crews[STUDIO_CHANNEL] ?? []).map((m) => m.id)
  );
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  (mockCrew.minusSigs ??= {})[STUDIO_CHANNEL] = parsed;
  return { status: "SAVED" };
}
