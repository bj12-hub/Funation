"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockSignatures } from "@/services/donations/signatureCore";
import { overlaySignal } from "./alertCore";
import { bridgeStore, claimBridge, firing, parseBridgeRules, reportBridge, showingEvent } from "./bridgeCore";
import type { BridgeClaim, BridgeData, BridgeResult, BridgeView } from "./bridgeTypes";
import { mockCreator } from "./mockCreatorStore";

/**
 * 외부 프로그램 연동 Server Actions — code-first (no Figma frame; StreamDonate "외부 프로그램 API" 참고, P3). Studio route
 * `/creator/widgets/bridge` (creator session); the 연동 페이지 `/overlay/bridge/[key]` (integration key) reads the matches,
 * claims each one and reports how sending went. The creator's addresses are only ever requested by that page.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Bridge API is not connected yet.");
};
const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

export async function getBridgeView(): Promise<BridgeView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const s = bridgeStore();
  return {
    rules: structuredClone(s.rules),
    log: structuredClone(s.log),
    signatures: mockSignatures.items.map((x) => ({ id: x.id, name: x.name, price: x.price })),
    bridgePath: `/overlay/bridge/${mockCreator.integrationKey}`
  };
}

/** Replaces the rules (a retried save writes the same values). */
export async function saveBridgeRules(input: unknown): Promise<BridgeResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const parsed = parseBridgeRules(rec(input).rules, MOCK_FORBIDDEN_WORDS, mockSignatures.items.map((x) => x.id));
  if ("message" in parsed) return { status: "INVALID", message: parsed.message };
  bridgeStore().rules = parsed;
  return { status: "SAVED" };
}

/** The 연동 페이지's read — no login; the integration key is the secret. Nothing fires with 리모컨 OFF. */
export async function getBridgeData(key: unknown): Promise<BridgeData | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key)) return "FORBIDDEN";
  const signal = overlaySignal("bridge");
  const event = signal.on ? showingEvent() : null;
  return { event, fire: firing(event), rules: bridgeStore().rules.filter((r) => r.enabled).length, ...signal };
}

export async function claimBridgeRule(key: unknown, input: unknown): Promise<BridgeClaim> {
  assertMock();
  if (!overlayKeyOpen(key) || !overlaySignal("bridge").on) return { status: "INVALID" };
  const v = rec(input);
  return claimBridge(v.alertId, v.ruleId);
}

export async function reportBridgeRule(key: unknown, input: unknown): Promise<{ status: "OK" | "INVALID" }> {
  assertMock();
  if (!overlayKeyOpen(key)) return { status: "INVALID" };
  const v = rec(input);
  reportBridge(v.claimId, v.outcome);
  return { status: "OK" };
}
