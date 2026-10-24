"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { ingestChat } from "@/services/broadcast/chatCore";
import { overlaySignal } from "./alertCore";
import { customChat, customStore, parseCustomSlot, showingDonation } from "./customOverlayCore";
import { slotByQuery, type CustomOverlayData, type CustomOverlayView, type CustomResult } from "./customOverlayTypes";
import { mockCreator } from "./mockCreatorStore";

/**
 * 커스텀 오버레이 Server Actions — code-first (no Figma frame; StreamDonate "오버레이 커스텀" 참고, P3). Studio route
 * `/creator/widgets/custom` (creator session), OBS `/overlay/custom/[key]?slot=1~5` (integration key). The code is only
 * stored and handed to the sandboxed frame; nothing here runs it.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Custom overlay API is not connected yet.");
};

export async function getCustomOverlayView(): Promise<CustomOverlayView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return { slots: structuredClone(customStore().slots), overlayKey: mockCreator.integrationKey };
}

/** Replaces one slot (a retried save writes the same values). */
export async function saveCustomOverlay(input: unknown): Promise<CustomResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseCustomSlot(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  customStore().slots[parsed.no - 1] = parsed.slot;
  return { status: "SAVED" };
}

/** OBS read — no login; the integration key is the secret. `slot`: the `?slot=` value (1 when unknown). */
export async function getCustomOverlay(key: unknown, slot: unknown): Promise<CustomOverlayData | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key)) return "FORBIDDEN";
  await ingestChat();
  const no = slotByQuery(slot);
  const s = customStore().slots[no - 1];
  const live = s.enabled && Boolean(s.html || s.css || s.js);
  return {
    slot: no,
    name: s.name,
    code: live ? { html: s.html, css: s.css, js: s.js } : null,
    donation: live ? showingDonation() : null,
    chat: live ? customChat() : [],
    ...overlaySignal("custom")
  };
}
