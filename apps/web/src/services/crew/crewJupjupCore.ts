import { mockSignatures } from "@/services/donations/signatureCore";
import { isActiveMember, liveBroadcastOf, timesMultiplier } from "./crewCore";
import { effectPoints, gameRunsView, parseAmountTiers, parseGameCommon, recordRun, signatureTrigger } from "./crewGameCore";
import { DEFAULT_JUPJUP, JUPJUP_MODES, JUPJUP_STACK_SHOWN, amountTierFor, type GameEffect, type JupjupLive, type JupjupSettings } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 줍줍 (server-only) — code-first, StreamDonate 줍줍 참고 (P2, a game on crewGameCore). Every 시그니처 후원 a 지정 BJ receives
 * piles up on a stack (whatever the amount); when another member receives one of the same amount, they take the oldest
 * such item and get points once more (더하기 · 배수 · 스핀머신 연계 모드). 지정 BJ never take from the stack.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/** The channel's 줍줍 settings (defaults until saved). */
export const jupjupSettingsOf = (channelId: string): JupjupSettings => mockCrew.jupjups?.[channelId] ?? DEFAULT_JUPJUP;

/**
 * Validates the settings. `memberIds`: the active crew (지정 BJ must be among them). Turning it on needs a 지정 BJ, and
 * the 배수 모드 a 금액 구간. `knownTiers`: the saved tier ids (kept).
 */
export function parseJupjupSettings(input: unknown, forbidden: string[], signatureIds: string[], memberIds: string[], knownTiers: string[]): JupjupSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  if (!Array.isArray(v.memberIds) || v.memberIds.some((id) => typeof id !== "string" || !memberIds.includes(id))) return { message: "지정 BJ를 다시 골라 주세요." };
  const owners = [...new Set(v.memberIds as string[])];
  const mode = JUPJUP_MODES.find((m) => m.key === v.mode)?.key;
  if (!mode) return { message: "줍줍 모드를 골라 주세요." };
  const tiers = parseAmountTiers(v.tiers, knownTiers, "jj");
  if ("message" in tiers) return tiers;
  if (common.auto && !owners.length) return { message: "줍줍을 켜려면 지정 BJ를 한 명 이상 골라 주세요." };
  if (common.auto && mode === "MULTIPLY" && !tiers.length) return { message: "배수 모드는 금액 구간을 하나 이상 만들어 주세요." };
  return { ...common, memberIds: owners, mode, tiers };
}

const stateOf = (b: MockBroadcast) => (b.jupjup ??= { stack: [] });
const signatureName = (id: string) => mockSignatures.items.find((x) => x.id === id)?.name ?? "시그니처";

/** What a take adds for the taker's donation worth `base` points (`donationId`: to find its 스핀머신 run). */
function takeEffect(b: MockBroadcast, s: JupjupSettings, donationId: string, amount: number, base: number): { kind: GameEffect; value: number; label: string } {
  if (s.mode === "MULTIPLY") {
    const m = amountTierFor(s.tiers, amount)?.multiplier ?? 1;
    return { kind: "MULTIPLY", value: m, label: `줍줍 ×${m}` };
  }
  if (s.mode === "SPIN") {
    const spin = (b.gameRuns ?? []).find((r) => r.game === "SPIN" && r.sourceId === donationId);
    const k = spin?.kind === "MULTIPLY" ? spin.value : 1;
    return { kind: "ADD", value: timesMultiplier(base, k), label: k > 1 ? `줍줍 · 스핀 ×${k} 연계` : "줍줍" };
  }
  return { kind: "ADD", value: base, label: "줍줍" };
}

/**
 * Called for every completed donation credited to a member (crewGameTriggers, after the other games — 스핀머신 연계 reads
 * the spin of the same donation), while a crew broadcast is live and 줍줍 is on: a 시그니처 후원 (not excluded) to a 지정 BJ
 * goes on the stack; one to another member takes the oldest stacked item of the same amount, if any (a run on OBS
 * `?jupjup`).
 */
export function jupjupForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const s = jupjupSettingsOf(channelId);
  const live = liveBroadcastOf(channelId);
  if (!live || !s.auto || !s.memberIds.length || !input.memberId || !input.signatureId || s.excluded.includes(input.signatureId) || !isActiveMember(channelId, input.memberId)) return;
  const state = stateOf(live);
  if (s.memberIds.includes(input.memberId)) {
    state.stack.push({ id: `jj-${input.donationId}`, at: new Date().toISOString(), memberId: input.memberId, signatureId: input.signatureId, signatureName: signatureName(input.signatureId), amount: input.fnAmount, donationId: input.donationId });
    return;
  }
  const i = state.stack.findIndex((x) => x.amount === input.fnAmount);
  const t = i >= 0 ? signatureTrigger(channelId, "JUPJUP", s, input) : null;
  if (!t) return;
  const [taken] = state.stack.splice(i, 1);
  const effect = takeEffect(live, s, input.donationId, input.fnAmount, t.start.basePoints);
  recordRun(live, {
    ...t.start,
    game: "JUPJUP",
    itemId: taken.signatureId,
    from: { memberId: taken.memberId, amount: taken.amount },
    ...effect,
    points: effectPoints(effect.kind, effect.value, t.start.basePoints)
  });
}

/**
 * 수동 추가: puts a signature on the stack for a 지정 BJ (its price is the amount). `requestId` is the item id, so a retried
 * add is not a second item. Returns an error message, or null.
 */
export function addJupjupItem(b: MockBroadcast, input: { requestId: string; memberId: unknown; signatureId: unknown }): string | null {
  const s = jupjupSettingsOf(b.channelId);
  const state = stateOf(b);
  if (state.stack.some((x) => x.id === input.requestId)) return null;
  if (typeof input.memberId !== "string" || !s.memberIds.includes(input.memberId) || !isActiveMember(b.channelId, input.memberId)) return "지정 BJ를 골라 주세요.";
  const sig = mockSignatures.items.find((x) => x.id === input.signatureId && x.active);
  if (!sig) return "시그니처를 골라 주세요.";
  state.stack.push({ id: input.requestId, at: new Date().toISOString(), memberId: input.memberId, signatureId: sig.id, signatureName: sig.name, amount: sig.price, donationId: null });
  return null;
}

/** Takes one item off the stack, or every item (`itemId` null — 스택 비우기). Removing a missing item is a no-op. */
export function removeJupjupItems(b: MockBroadcast, itemId: string | null) {
  const state = stateOf(b);
  state.stack = itemId === null ? [] : state.stack.filter((x) => x.id !== itemId);
}

export function jupjupLive(b: MockBroadcast): JupjupLive {
  const s = jupjupSettingsOf(b.channelId);
  const crew = mockCrew.crews[b.channelId] ?? [];
  const stack = b.jupjup?.stack ?? [];
  return {
    settings: structuredClone(s),
    runs: gameRunsView(b, "JUPJUP"),
    stack: stack.slice(0, JUPJUP_STACK_SHOWN).map((x) => {
      const m = crew.find((c) => c.id === x.memberId);
      return { id: x.id, at: x.at, memberName: m?.name ?? "삭제된 멤버", memberColor: m?.color ?? null, signatureName: x.signatureName, amount: x.amount, manual: x.donationId === null };
    }),
    stackCount: stack.length,
    ownerNames: s.memberIds.map((id) => crew.find((c) => c.id === id)?.name ?? "삭제된 멤버")
  };
}
