import { randomUUID } from "node:crypto";
import { matchSignatureByAmount, mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS, spanText, type ManagedSignature } from "@/services/donations/signatureTypes";
import { excelOf, isActiveMember, liveBroadcastOf, parseMultiplier, scoreFn } from "./crewCore";
import { drawIndex, effectPoints, gameRunsView, parseGameCommon, recordRun } from "./crewGameCore";
import {
  DEFAULT_RANDOM_SIG,
  RANDOM_SIG_MODES,
  RANDOM_SIG_MULTIPLIER_MAX,
  RANDOM_SIG_TIERS_MAX,
  type RandomSigLive,
  type RandomSigSettings,
  type RandomSigTier
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 랜덤시그 (server-only) — code-first, StreamDonate 랜덤시그 참고 (P2, a game on crewGameCore). A 일반 후원 of exactly a
 * 발동 금액 plays a signature drawn on the server from that 발동 구간's price range: the alert shows and plays it (and
 * 시그 카운트 · the other games count it). While a crew broadcast is live, a donation credited to a member also records a
 * run with points (기본 모드 · 랜덤 결과 모드). StreamDonate's 앞자리 배수 is not built (its 백만원 place does not fit FN).
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const fn = (n: number) => n.toLocaleString("ko-KR");

/** The channel's 랜덤시그 settings (defaults until saved). */
export const randomSigSettingsOf = (channelId: string): RandomSigSettings => mockCrew.randomSigs?.[channelId] ?? DEFAULT_RANDOM_SIG;

/**
 * Validates the settings. A 발동 금액 an active 금액 일치 signature takes is refused (that signature keeps the amount, so
 * the tier would never fire). `knownTiers`: the saved tier ids (kept); any other id is replaced.
 */
export function parseRandomSigSettings(input: unknown, forbidden: string[], signatureIds: string[], knownTiers: string[]): RandomSigSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const { priceMin, priceMax } = SIGNATURE_LIMITS;
  if (!Array.isArray(v.tiers) || v.tiers.length > RANDOM_SIG_TIERS_MAX) return { message: `발동 구간은 ${RANDOM_SIG_TIERS_MAX}개까지 만들 수 있어요.` };
  const tiers: RandomSigTier[] = [];
  for (const raw of v.tiers) {
    const t = rec(raw);
    if (!isInt(t.trigger, priceMin, priceMax)) return { message: `발동 금액은 ${fn(priceMin)} ~ ${fn(priceMax)} FN이에요.` };
    if (!isInt(t.min, 0, priceMax) || !isInt(t.max, 0, priceMax) || t.min > t.max) return { message: "시그 금액 범위를 확인해 주세요." };
    if (tiers.some((x) => x.trigger === t.trigger)) return { message: "같은 발동 금액의 구간이 있어요." };
    const taken = matchSignatureByAmount(t.trigger);
    if (taken) return { message: `발동 금액 ${fn(t.trigger)} FN은 '${taken.name}'(${spanText(taken)}) 시그니처가 금액 일치로 받아요.` };
    const keep = typeof t.id === "string" && knownTiers.includes(t.id) && !tiers.some((x) => x.id === t.id);
    tiers.push({ id: keep ? (t.id as string) : `rs-${randomUUID().slice(0, 8)}`, trigger: t.trigger, min: t.min, max: t.max });
  }
  const mode = RANDOM_SIG_MODES.find((m) => m.key === v.mode)?.key;
  if (!mode) return { message: "기여도 방식을 골라 주세요." };
  const multiplier = parseMultiplier(v.multiplier, RANDOM_SIG_MULTIPLIER_MAX);
  if (multiplier === null || multiplier <= 1) return { message: `기본 배수는 1보다 크고 ${RANDOM_SIG_MULTIPLIER_MAX}배 이하, 소수 둘째 자리까지예요.` };
  return { ...common, tiers, mode, multiplier };
}

/** The signatures a 랜덤시그 can draw: active and not excluded (제외 시그). */
const poolOf = (s: RandomSigSettings) => mockSignatures.items.filter((x) => x.active && !s.excluded.includes(x.id));

export type RandomSigDraw = { signature: ManagedSignature; tier: RandomSigTier };

/**
 * Called by the Donation Core for a 일반 후원: when 랜덤시그 is on, no 금액 일치 signature takes the amount and it equals a
 * 발동 금액, one of the tier's signatures is drawn (evenly, on the server). Null otherwise — also when the tier has no
 * signature to draw (the donation stays a 일반 후원).
 */
export function drawRandomSig(channelId: string, amount: number): RandomSigDraw | null {
  const s = randomSigSettingsOf(channelId);
  if (!s.auto || matchSignatureByAmount(amount)) return null;
  const tier = s.tiers.find((t) => t.trigger === amount);
  const candidates = tier ? poolOf(s).filter((x) => x.price >= tier.min && x.price <= tier.max) : [];
  return tier && candidates.length ? { signature: candidates[drawIndex(candidates.map(() => 1))], tier } : null;
}

/**
 * The 점수 게임 side, once the donation is credited: while a crew broadcast is live, a 랜덤시그 donation sent to a member
 * records a run (OBS `?randomsig`). 기본 모드: × 기본 배수 when the drawn signature is priced at or above the 발동 금액,
 * else 1배. 랜덤 결과 모드: the drawn signature's points replace the donation's (the run adds the difference).
 */
export function randomSigRun(channelId: string, input: { donationId: string; memberId: string | null; fnAmount: number; drawn: RandomSigDraw | null }) {
  const live = liveBroadcastOf(channelId);
  if (!live || !input.drawn || !input.memberId || !isActiveMember(channelId, input.memberId)) return;
  const s = randomSigSettingsOf(channelId);
  const excel = excelOf(channelId);
  const base = scoreFn(input.fnAmount, excel);
  const { signature, tier } = input.drawn;
  const effect =
    s.mode === "REPLACE"
      ? { kind: "ADD" as const, value: scoreFn(signature.price, excel) - base }
      : { kind: "MULTIPLY" as const, value: signature.price >= tier.trigger ? s.multiplier : 1 };
  recordRun(live, {
    id: `randomsig-${input.donationId}`,
    game: "RANDOM_SIG",
    memberId: input.memberId,
    trigger: { kind: "AMOUNT", amount: tier.trigger },
    sourceId: input.donationId,
    basePoints: base,
    itemId: signature.id,
    range: [tier.min, tier.max],
    label: signature.name,
    ...effect,
    points: effectPoints(effect.kind, effect.value, base)
  });
}

export function randomSigLive(b: MockBroadcast): RandomSigLive {
  const s = randomSigSettingsOf(b.channelId);
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "RANDOM_SIG"),
    pool: poolOf(s).map((x) => ({ id: x.id, name: x.name, price: x.price, imageUrl: signatureImageOf(x) }))
  };
}
