import { randomUUID } from "node:crypto";
import { SIGNATURE_LIMITS } from "@/services/donations/signatureTypes";
import { isActiveMember, liveBroadcastOf, parseMultiplier } from "./crewCore";
import { effectPoints, gameRunsView, parseGameCommon, recordRun, signatureTrigger } from "./crewGameCore";
import { DEFAULT_RELAY, RELAY_MULTIPLIER_MAX, RELAY_TIERS_MAX, relayTierFor, type RelayLive, type RelaySettings, type RelayTier } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 기여도 릴레이 (server-only) — code-first, StreamDonate 기여도 릴레이 참고 (P2, a game on crewGameCore). A 시그니처 후원
 * the 트리거 BJ receives sets a 배수 by its amount (the first matching 금액 구간; none clears it); the next 시그니처 후원
 * another member receives takes it — (배수 − 1) × that donation's points — and the 배수 is used up.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** The channel's 기여도 릴레이 settings (defaults until saved). */
export const relaySettingsOf = (channelId: string): RelaySettings => mockCrew.relays?.[channelId] ?? DEFAULT_RELAY;

/**
 * Validates the settings. `memberIds`: the active crew (the 트리거 BJ must be one). Turning it on needs a 트리거 BJ and at
 * least one 금액 구간. `knownTiers`: the saved tier ids (kept); any other id is replaced.
 */
export function parseRelaySettings(input: unknown, forbidden: string[], signatureIds: string[], memberIds: string[], knownTiers: string[]): RelaySettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  if (v.memberId !== null && v.memberId !== undefined && !(typeof v.memberId === "string" && memberIds.includes(v.memberId))) return { message: "트리거 BJ를 다시 골라 주세요." };
  const memberId = (v.memberId as string | null | undefined) ?? null;
  const { priceMax } = SIGNATURE_LIMITS;
  if (!Array.isArray(v.tiers) || v.tiers.length > RELAY_TIERS_MAX) return { message: `금액 구간은 ${RELAY_TIERS_MAX}개까지 만들 수 있어요.` };
  const tiers: RelayTier[] = [];
  for (const raw of v.tiers) {
    const t = rec(raw);
    if (!isInt(t.min, 0, priceMax) || (t.max !== null && !isInt(t.max, t.min, priceMax))) return { message: "금액 구간을 확인해 주세요. 최대는 최소 이상이고, 비우면 '이상'이에요." };
    const multiplier = parseMultiplier(t.multiplier, RELAY_MULTIPLIER_MAX);
    if (multiplier === null || multiplier <= 1) return { message: `배수는 1보다 크고 ${RELAY_MULTIPLIER_MAX}배 이하, 소수 둘째 자리까지예요.` };
    const keep = typeof t.id === "string" && knownTiers.includes(t.id) && !tiers.some((x) => x.id === t.id);
    tiers.push({ id: keep ? (t.id as string) : `rl-${randomUUID().slice(0, 8)}`, min: t.min, max: t.max as number | null, multiplier });
  }
  if (common.auto && !memberId) return { message: "릴레이를 켜려면 트리거 BJ를 골라 주세요." };
  if (common.auto && !tiers.length) return { message: "릴레이를 켜려면 금액 구간을 하나 이상 만들어 주세요." };
  return { ...common, memberId, tiers };
}

const stateOf = (b: MockBroadcast) => (b.relay ??= { pending: null });

/**
 * Called for every completed donation credited to a member (crewGameTriggers), while a crew broadcast is live and the
 * relay is on: a 시그니처 후원 (not excluded) to the 트리거 BJ sets the pending 배수 — or clears it when no 구간 matches; one
 * to another member takes the pending 배수 (a run on OBS `?relay`).
 */
export function relayForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const s = relaySettingsOf(channelId);
  const live = liveBroadcastOf(channelId);
  if (!live || !s.auto || !s.memberId || !input.memberId || !input.signatureId || s.excluded.includes(input.signatureId) || !isActiveMember(channelId, input.memberId)) return;
  const state = stateOf(live);
  if (input.memberId === s.memberId) {
    const tier = relayTierFor(s.tiers, input.fnAmount);
    state.pending = tier ? { multiplier: tier.multiplier, amount: input.fnAmount, at: new Date().toISOString(), donationId: input.donationId } : null;
    return;
  }
  const pending = state.pending;
  const t = pending ? signatureTrigger(channelId, "RELAY", s, input) : null;
  if (!pending || !t) return;
  state.pending = null;
  recordRun(t.live, {
    ...t.start,
    game: "RELAY",
    itemId: null,
    from: { memberId: s.memberId, amount: pending.amount },
    label: `×${pending.multiplier} 릴레이`,
    kind: "MULTIPLY",
    value: pending.multiplier,
    points: effectPoints("MULTIPLY", pending.multiplier, t.start.basePoints)
  });
}

/** 대기 비우기: the pending 배수 goes away (the next 트리거 후원 sets a new one). */
export function clearRelayPending(b: MockBroadcast) {
  stateOf(b).pending = null;
}

export function relayLive(b: MockBroadcast): RelayLive {
  const s = relaySettingsOf(b.channelId);
  const pending = b.relay?.pending ?? null;
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "RELAY"),
    pending: pending && { multiplier: pending.multiplier, amount: pending.amount, at: pending.at },
    triggerName: s.memberId ? ((mockCrew.crews[b.channelId] ?? []).find((m) => m.id === s.memberId)?.name ?? "삭제된 멤버") : null
  };
}
