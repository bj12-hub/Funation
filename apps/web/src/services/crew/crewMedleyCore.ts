import { matchSignatureByAmount, mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS, spanText, type ManagedSignature } from "@/services/donations/signatureTypes";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { drawIndex, gameRunsView, parseGameCommon, recordRun, type StoredRun } from "./crewGameCore";
import { DEFAULT_MEDLEY, MEDLEY_SIGNATURES_MAX, type MedleyLive, type MedleySettings } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 시그니처 메들리 (server-only) — code-first, StreamDonate 메들리 참고 (a signature game on crewGameCore). A 일반 후원 of
 * exactly the 메들리 금액 plays one of the registered signatures, drawn on the server: the alert shows and plays it (시그
 * 카운트 · the other games count it). No points — the donation counts as it is. While a crew broadcast is live each
 * medley also rolls on OBS `?medley` (with or without a member); the operator can roll one by hand.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const fn = (n: number) => n.toLocaleString("ko-KR");

/** The channel's 메들리 settings (defaults until saved). */
export const medleySettingsOf = (channelId: string): MedleySettings => mockCrew.medleys?.[channelId] ?? DEFAULT_MEDLEY;

/**
 * Validates the settings. Turning it on needs a 발동 금액 and a registered signature. A 발동 금액 an active 금액 일치 signature
 * takes is refused, and so is one `takenBy` names (랜덤시그 uses it — checked by the caller while both are on).
 */
export function parseMedleySettings(input: unknown, forbidden: string[], signatureIds: string[], takenBy: (amount: number) => string | null): MedleySettings | { message: string } {
  const common = parseGameCommon({ ...rec(input), excluded: [] }, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const { priceMin, priceMax } = SIGNATURE_LIMITS;
  if (v.trigger !== null && v.trigger !== undefined && !isInt(v.trigger, priceMin, priceMax)) return { message: `발동 금액은 ${fn(priceMin)} ~ ${fn(priceMax)} FN이에요.` };
  const trigger = (v.trigger as number | null | undefined) ?? null;
  if (!Array.isArray(v.signatureIds) || v.signatureIds.some((id) => typeof id !== "string" || !signatureIds.includes(id))) return { message: "등록할 시그니처를 확인해 주세요." };
  const ids = [...new Set(v.signatureIds as string[])];
  if (ids.length > MEDLEY_SIGNATURES_MAX) return { message: `메들리에는 시그니처를 ${MEDLEY_SIGNATURES_MAX}개까지 등록할 수 있어요.` };
  if (common.auto && trigger === null) return { message: "메들리를 켜려면 발동 금액을 정해 주세요." };
  if (common.auto && !ids.length) return { message: "메들리를 켜려면 시그니처를 하나 이상 등록해 주세요." };
  if (trigger !== null) {
    const taken = matchSignatureByAmount(trigger);
    if (taken) return { message: `발동 금액 ${fn(trigger)} FN은 '${taken.name}'(${spanText(taken)}) 시그니처가 금액 일치로 받아요.` };
    const other = common.auto ? takenBy(trigger) : null;
    if (other) return { message: `발동 금액 ${fn(trigger)} FN은 이미 ${other}에서 쓰고 있어요.` };
  }
  return { ...common, trigger, signatureIds: ids };
}

/** The registered signatures that can be drawn: active ones, in the creator's order. */
const poolOf = (s: MedleySettings) => mockSignatures.items.filter((x) => x.active && s.signatureIds.includes(x.id));

export type MedleyDraw = { signature: ManagedSignature };

/**
 * Called by the Donation Core for a 일반 후원 no 금액 일치 signature or 랜덤시그 took: when 메들리 is on and the amount is its
 * 발동 금액, one registered signature is drawn (evenly, on the server). Null otherwise, or with nothing to draw.
 */
export function drawMedley(channelId: string, amount: number): MedleyDraw | null {
  const s = medleySettingsOf(channelId);
  if (!s.auto || s.trigger !== amount || matchSignatureByAmount(amount)) return null;
  const pool = poolOf(s);
  return pool.length ? { signature: pool[drawIndex(pool.map(() => 1))] } : null;
}

/** A medley run on OBS `?medley` (no points); `memberId` "" = none. */
function recordMedley(b: MockBroadcast, run: Pick<StoredRun, "id" | "memberId" | "trigger" | "sourceId">, signature: ManagedSignature) {
  return recordRun(b, { ...run, game: "MEDLEY", basePoints: 0, itemId: signature.id, label: signature.name, kind: "TEXT", value: 0, points: 0 });
}

/** While a crew broadcast is live, every medley donation rolls on OBS — for the member the supporter picked, or none. */
export function medleyRun(channelId: string, input: { donationId: string; memberId: string | null; amount: number; drawn: MedleyDraw | null }) {
  const live = liveBroadcastOf(channelId);
  if (!live || !input.drawn) return;
  const memberId = input.memberId && isActiveMember(channelId, input.memberId) ? input.memberId : "";
  recordMedley(live, { id: `medley-${input.donationId}`, memberId, trigger: { kind: "AMOUNT", amount: input.amount }, sourceId: input.donationId }, input.drawn.signature);
}

/**
 * 수동 메들리: draws a registered signature and rolls it on OBS (no alert, no points). `requestId` is the run id, so a retry
 * returns the same run. Returns the run, or an error message.
 */
export function playMedleyRun(b: MockBroadcast, requestId: string): StoredRun | string {
  const previous = (b.gameRuns ?? []).find((r) => r.id === requestId);
  if (previous) return previous;
  const pool = poolOf(medleySettingsOf(b.channelId));
  if (!pool.length) return "등록한 시그니처가 없어요. 메들리 시그니처를 먼저 등록해 주세요.";
  return recordMedley(b, { id: requestId, memberId: "", trigger: { kind: "MANUAL" }, sourceId: null }, pool[drawIndex(pool.map(() => 1))]);
}

export function medleyLive(b: MockBroadcast): MedleyLive {
  const s = medleySettingsOf(b.channelId);
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "MEDLEY"),
    pool: poolOf(s).map((x) => ({ id: x.id, name: x.name, price: x.price, imageUrl: signatureImageOf(x) }))
  };
}
