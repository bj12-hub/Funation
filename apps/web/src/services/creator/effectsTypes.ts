/**
 * 이모지 리액션 · 레이어 효과 — code-first (funnation 위젯 "이펙트 · 효과"). The creator sets every
 * trigger (these are channel settings, not platform policy). The server resolves which effect a donation
 * alert plays; the OBS overlay only renders it.
 */

export const EMOJI_PRESETS = ["❤️", "🔥", "🎉", "👏", "😍", "⭐", "💜", "🌸", "💎", "🍀", "😂", "🚀"] as const;
export const LAYER_EFFECTS = [
  { key: "CONFETTI", label: "꽃가루", emoji: "🎊" },
  { key: "HEARTS", label: "하트 비", emoji: "💖" },
  { key: "STARS", label: "별빛", emoji: "✨" },
  { key: "FIREWORKS", label: "불꽃놀이", emoji: "🎆" }
] as const;
export type LayerEffect = (typeof LAYER_EFFECTS)[number]["key"];

export const EFFECT_LIMITS = { minFnMax: 10_000_000, countMin: 5, countMax: 40, emojisMax: 6, tiersMax: 4 } as const;

export type EffectSettings = {
  emoji: { enabled: boolean; minFn: number; emojis: string[]; count: number };
  layer: { enabled: boolean; tiers: { minFn: number; effect: LayerEffect }[] };
};

export const DEFAULT_EFFECTS: EffectSettings = {
  emoji: { enabled: false, minFn: 1_000, emojis: ["❤️", "🎉"], count: 16 },
  layer: { enabled: false, tiers: [{ minFn: 50_000, effect: "CONFETTI" }] }
};

/** What the overlay plays for the alert on screen (null parts = nothing). */
export type OverlayEffects = {
  alertId: string | null;
  emoji: { emojis: string[]; count: number } | null;
  layer: LayerEffect | null;
  /** 리모컨 "오버레이 새로고침" signal. */
  reloadSeq: number;
};

export type EffectsResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
