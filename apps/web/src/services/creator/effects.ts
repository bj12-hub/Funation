"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { advance, mockAlerts } from "./alertCore";
import {
  DEFAULT_EFFECTS,
  EFFECT_LIMITS,
  EMOJI_PRESETS,
  LAYER_EFFECTS,
  type EffectSettings,
  type EffectsResult,
  type LayerEffect,
  type OverlayEffects
} from "./effectsTypes";
import { mockCreator } from "./mockCreatorStore";

/**
 * 이펙트 설정 Server Actions — code-first. Route `/creator/widgets/effects`, overlay
 * `/overlay/effects/[key]`. Effects follow the donation alert queue (the alert on screen decides).
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Effects API is not connected yet.");
};

const g = globalThis as typeof globalThis & { __funationMockEffectsV1?: EffectSettings };
const store = () => (g.__funationMockEffectsV1 ??= structuredClone(DEFAULT_EFFECTS));

export async function getEffectSettings(): Promise<EffectSettings | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return structuredClone(store());
}

const fnOk = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= EFFECT_LIMITS.minFnMax;

export async function saveEffectSettings(input: unknown): Promise<EffectsResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Partial<EffectSettings>;
  const e = v.emoji;
  if (!e || typeof e.enabled !== "boolean" || !fnOk(e.minFn)) return { status: "INVALID", message: "이모지 리액션 설정을 확인해 주세요." };
  if (!Array.isArray(e.emojis) || e.emojis.length < 1 || e.emojis.length > EFFECT_LIMITS.emojisMax || e.emojis.some((x) => !EMOJI_PRESETS.includes(x as (typeof EMOJI_PRESETS)[number]))) {
    return { status: "INVALID", message: `이모지는 1~${EFFECT_LIMITS.emojisMax}개 골라 주세요.` };
  }
  if (typeof e.count !== "number" || !Number.isInteger(e.count) || e.count < EFFECT_LIMITS.countMin || e.count > EFFECT_LIMITS.countMax) {
    return { status: "INVALID", message: `이모지 개수는 ${EFFECT_LIMITS.countMin}~${EFFECT_LIMITS.countMax}개예요.` };
  }
  const l = v.layer;
  if (!l || typeof l.enabled !== "boolean" || !Array.isArray(l.tiers) || l.tiers.length < 1 || l.tiers.length > EFFECT_LIMITS.tiersMax) {
    return { status: "INVALID", message: `레이어 효과 구간은 1~${EFFECT_LIMITS.tiersMax}개예요.` };
  }
  const keys = LAYER_EFFECTS.map((x) => x.key) as string[];
  if (l.tiers.some((t) => !t || !fnOk(t.minFn) || !keys.includes(t.effect))) return { status: "INVALID", message: "레이어 효과 구간을 확인해 주세요." };
  const mins = l.tiers.map((t) => t.minFn);
  if (new Set(mins).size !== mins.length) return { status: "INVALID", message: "구간 금액이 겹쳐요. 금액을 다르게 입력해 주세요." };
  g.__funationMockEffectsV1 = {
    emoji: { enabled: e.enabled, minFn: e.minFn, emojis: [...new Set(e.emojis)], count: e.count },
    layer: { enabled: l.enabled, tiers: [...l.tiers].sort((a, b) => a.minFn - b.minFn).map((t) => ({ minFn: t.minFn, effect: t.effect as LayerEffect })) }
  };
  return { status: "SAVED" };
}

/** Pure resolution (exported for tests through the overlay read). */
function resolve(settings: EffectSettings, fnAmount: number): Pick<OverlayEffects, "emoji" | "layer"> {
  const emoji = settings.emoji.enabled && fnAmount >= settings.emoji.minFn ? { emojis: settings.emoji.emojis, count: settings.emoji.count } : null;
  const tier = settings.layer.enabled ? [...settings.layer.tiers].reverse().find((t) => fnAmount >= t.minFn) : undefined;
  return { emoji, layer: tier?.effect ?? null };
}

/** OBS overlay read — no login; the integration key is the secret. */
export async function getOverlayEffects(key: unknown): Promise<OverlayEffects | "FORBIDDEN"> {
  assertMock();
  if (typeof key !== "string" || key !== mockCreator.integrationKey) return "FORBIDDEN";
  advance();
  const showing = mockAlerts.items.find((a) => a.status === "SHOWING");
  const reloadSeq = mockAlerts.reloadSeq;
  if (!showing) return { alertId: null, emoji: null, layer: null, reloadSeq };
  return { alertId: showing.id, ...resolve(store(), showing.fnAmount), reloadSeq };
}
