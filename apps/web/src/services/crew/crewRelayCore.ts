import { randomUUID } from "node:crypto";
import { isActiveMember, liveBroadcastOf } from "./crewCore";
import { effectPoints, gameRunsView, parseAmountTiers, parseGameCommon, recordRun, signatureTrigger } from "./crewGameCore";
import { DEFAULT_RELAY, RELAY_PRESETS_MAX, RELAY_PRESET_NAME_MAX, relayTierFor, type RelayLive, type RelayPreset, type RelaySettings } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 기여도 릴레이 (server-only) — code-first, StreamDonate 기여도 릴레이 참고 (P2, a game on crewGameCore). A 시그니처 후원
 * the 트리거 BJ receives sets a 배수 by its amount (the first matching 금액 구간; none clears it); the next 시그니처 후원
 * another member receives takes it — (배수 − 1) × that donation's points — and the 배수 is used up.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

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
  const tiers = parseAmountTiers(v.tiers, knownTiers, "rl");
  if ("message" in tiers) return tiers;
  if (common.auto && !memberId) return { message: "릴레이를 켜려면 트리거 BJ를 골라 주세요." };
  if (common.auto && !tiers.length) return { message: "릴레이를 켜려면 금액 구간을 하나 이상 만들어 주세요." };
  return { ...common, memberId, tiers };
}

/** The channel's 기여도 릴레이 설정 프리셋, newest first. */
export const relayPresetsOf = (channelId: string): RelayPreset[] => mockCrew.relayPresets?.[channelId] ?? [];

/**
 * 설정 프리셋 저장 (2026-10-28, as on 랜덤시그): `settings` (the card as it is, checked like 설정 저장) under `name` — 트리거 BJ ·
 * 금액 구간 · 제외 시그. The same name replaces that 프리셋 and moves it first; a new name needs a free slot.
 */
export function saveRelayPresetOf(
  channelId: string,
  input: unknown,
  forbidden: string[],
  signatureIds: string[],
  memberIds: string[],
  now = new Date()
): { status: "SAVED" } | { message: string } {
  const v = rec(input);
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name) return { message: "프리셋 이름을 입력해 주세요." };
  if ([...name].length > RELAY_PRESET_NAME_MAX) return { message: `프리셋 이름은 ${RELAY_PRESET_NAME_MAX}자까지예요.` };
  if (forbidden.some((w) => name.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  const parsed = parseRelaySettings(v.settings, forbidden, signatureIds, memberIds, relaySettingsOf(channelId).tiers.map((x) => x.id));
  if ("message" in parsed) return parsed;
  const list = relayPresetsOf(channelId);
  const same = list.find((p) => p.name === name);
  if (!same && list.length >= RELAY_PRESETS_MAX) return { message: `프리셋은 ${RELAY_PRESETS_MAX}개까지 저장할 수 있어요. 안 쓰는 프리셋을 지워 주세요.` };
  const preset = {
    id: same?.id ?? `rlp-${randomUUID().slice(0, 8)}`,
    name,
    savedAt: now.toISOString(),
    settings: structuredClone({ memberId: parsed.memberId, tiers: parsed.tiers, excluded: parsed.excluded })
  };
  (mockCrew.relayPresets ??= {})[channelId] = [preset, ...list.filter((p) => p !== same)];
  return { status: "SAVED" };
}

/** 프리셋 삭제 (one already gone is fine — a retried delete). */
export function deleteRelayPresetOf(channelId: string, id: unknown) {
  const list = relayPresetsOf(channelId);
  if (list.some((p) => p.id === id)) (mockCrew.relayPresets ??= {})[channelId] = list.filter((p) => p.id !== id);
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
