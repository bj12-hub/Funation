import { randomUUID } from "node:crypto";
import { matchSignatureByAmount, mockSignatures, signatureImageOf } from "@/services/donations/signatureCore";
import { SIGNATURE_LIMITS, spanText, type ManagedSignature } from "@/services/donations/signatureTypes";
import { excelOf, isActiveMember, liveBroadcastOf, parseMultiplier, scoreFn } from "./crewCore";
import { drawIndex, effectPoints, gameRunsView, parseGameCommon, recordRun } from "./crewGameCore";
import {
  DEFAULT_RANDOM_SIG,
  RANDOM_SIG_DIGIT_MAX,
  RANDOM_SIG_DIGIT_UNITS,
  RANDOM_SIG_MODES,
  RANDOM_SIG_MULTIPLIER_MAX,
  RANDOM_SIG_PRESETS_MAX,
  RANDOM_SIG_PRESET_NAME_MAX,
  RANDOM_SIG_TIERS_MAX,
  type RandomSigLive,
  type RandomSigPreset,
  type RandomSigSettings,
  type RandomSigTier,
  digitMultiplier,
  presetFieldsOf
} from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 랜덤시그 (server-only) — code-first, StreamDonate 랜덤시그 참고 (P2, a game on crewGameCore). A 일반 후원 of exactly a
 * 발동 금액 plays a signature drawn on the server from that 발동 구간's price range: the alert shows and plays it (and
 * 시그 카운트 · the other games count it). While a crew broadcast is live, a donation credited to a member also records a
 * run with points (기본 모드 — 기본 배수 or 앞자리 배수 — · 랜덤 결과 모드).
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const fn = (n: number) => n.toLocaleString("ko-KR");

/** The channel's 랜덤시그 settings (defaults until saved; fields added later take their 기본값). */
export const randomSigSettingsOf = (channelId: string): RandomSigSettings => ({ ...DEFAULT_RANDOM_SIG, ...mockCrew.randomSigs?.[channelId] });

/**
 * Validates the settings. A 발동 금액 an active 금액 일치 signature takes is refused (that signature keeps the amount, so
 * the tier would never fire). With 앞자리 배수 on (기본 모드), every tier draws from at least one 자리 unit and at most
 * ×RANDOM_SIG_DIGIT_MAX. `knownTiers`: the saved tier ids (kept); any other id is replaced.
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
  if (typeof v.digit !== "boolean") return { message: "앞자리 배수를 확인해 주세요." };
  const unit = RANDOM_SIG_DIGIT_UNITS.find((u) => u.unit === v.digitUnit);
  if (!unit) return { message: "앞자리 배수의 자리 단위를 골라 주세요." };
  if (v.digit && mode === "BONUS") {
    if (tiers.some((t) => t.min < unit.unit)) return { message: `앞자리 배수를 켜면 시그 최소는 ${fn(unit.unit)} FN(${unit.label}) 이상이에요.` };
    if (tiers.some((t) => digitMultiplier(t.max, unit.unit) > RANDOM_SIG_DIGIT_MAX))
      return { message: `앞자리 배수는 ${RANDOM_SIG_DIGIT_MAX}배까지예요. 시그 최대를 ${fn(unit.unit * (RANDOM_SIG_DIGIT_MAX + 1) - 1)} FN 이하로 하거나 자리 단위를 키워 주세요.` };
  }
  return { ...common, tiers, mode, multiplier, digit: v.digit, digitUnit: unit.unit };
}

/** The channel's 랜덤시그 설정 프리셋, newest first. */
export const randomSigPresetsOf = (channelId: string): RandomSigPreset[] => mockCrew.randomSigPresets?.[channelId] ?? [];

/**
 * 설정 프리셋 저장: `settings` (the card as it is, checked like 설정 저장) under `name` — 켜짐 · 제목 · 대기 화면 left out.
 * The same name replaces that 프리셋 and moves it first (so a retry stays one 프리셋); a new name needs a free slot.
 */
export function saveRandomSigPresetOf(channelId: string, input: unknown, forbidden: string[], signatureIds: string[], now = new Date()): { status: "SAVED" } | { message: string } {
  const v = rec(input);
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name) return { message: "프리셋 이름을 입력해 주세요." };
  if ([...name].length > RANDOM_SIG_PRESET_NAME_MAX) return { message: `프리셋 이름은 ${RANDOM_SIG_PRESET_NAME_MAX}자까지예요.` };
  if (forbidden.some((w) => name.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  const parsed = parseRandomSigSettings(v.settings, forbidden, signatureIds, randomSigSettingsOf(channelId).tiers.map((x) => x.id));
  if ("message" in parsed) return parsed;
  const list = randomSigPresetsOf(channelId);
  const same = list.find((p) => p.name === name);
  if (!same && list.length >= RANDOM_SIG_PRESETS_MAX) return { message: `프리셋은 ${RANDOM_SIG_PRESETS_MAX}개까지 저장할 수 있어요. 안 쓰는 프리셋을 지워 주세요.` };
  const preset = { id: same?.id ?? `rsp-${randomUUID().slice(0, 8)}`, name, savedAt: now.toISOString(), settings: structuredClone(presetFieldsOf(parsed)) };
  (mockCrew.randomSigPresets ??= {})[channelId] = [preset, ...list.filter((p) => p !== same)];
  return { status: "SAVED" };
}

/** 프리셋 삭제 (one already gone is fine — a retried delete). */
export function deleteRandomSigPresetOf(channelId: string, id: unknown) {
  const list = randomSigPresetsOf(channelId);
  if (list.some((p) => p.id === id)) (mockCrew.randomSigPresets ??= {})[channelId] = list.filter((p) => p.id !== id);
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
 * else 1배 — or, with 앞자리 배수, × the price's 자리 units (no comparison with the 발동 금액). 랜덤 결과 모드: the drawn
 * signature's points replace the donation's (the run adds the difference).
 */
export function randomSigRun(channelId: string, input: { donationId: string; memberId: string | null; fnAmount: number; drawn: RandomSigDraw | null }) {
  const live = liveBroadcastOf(channelId);
  if (!live || !input.drawn || !input.memberId || !isActiveMember(channelId, input.memberId)) return;
  const s = randomSigSettingsOf(channelId);
  const excel = excelOf(channelId);
  const base = scoreFn(input.fnAmount, excel);
  const { signature, tier } = input.drawn;
  const digit = s.mode === "BONUS" && s.digit;
  const effect =
    s.mode === "REPLACE"
      ? { kind: "ADD" as const, value: scoreFn(signature.price, excel) - base }
      : { kind: "MULTIPLY" as const, value: digit ? Math.max(1, digitMultiplier(signature.price, s.digitUnit)) : signature.price >= tier.trigger ? s.multiplier : 1 };
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
    ...(digit && { digit: s.digitUnit }),
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
