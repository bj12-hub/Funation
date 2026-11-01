import { kstDateString } from "@/lib/period";
import { findAsset } from "./assetCore";
import { DEFAULT_WIDGET_SETTINGS, type EditableWidgetKey, type WidgetSettingsMap } from "./widgetSettingsTypes";

/**
 * Server-only widget settings store (not a "use server" module): the settings actions write it and the
 * 후원 위젯 OBS overlays read it.
 */

/**
 * The defaults with their periods on the Korean calendar of `now`: 후원목표 this month, 총 후원 금액 this year. The
 * Figma frames show 2026-09-01 ~ 2026-09-30 and 2026-01-01 ~ 2026-12-31, the month and year they were drawn in; kept as
 * fixed dates they would leave a new channel's widgets counting nothing once those were over.
 */
export function defaultWidgetSettings(now = new Date()): WidgetSettingsMap {
  const defaults = structuredClone(DEFAULT_WIDGET_SETTINGS);
  const [year, month] = kstDateString(now).split("-");
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  defaults.GOAL = { ...defaults.GOAL, from: `${year}-${month}-01`, to: `${year}-${month}-${lastDay}` };
  defaults.TOTAL = { ...defaults.TOTAL, from: `${year}-01-01T00:00`, to: `${year}-12-31T23:59` };
  return defaults;
}

const g = globalThis as typeof globalThis & { __ssumnationMockWidgetsV4?: WidgetSettingsMap };
const initial = defaultWidgetSettings();
export const widgetStore = (g.__ssumnationMockWidgetsV4 ??= initial);
// A store created before a widget existed (e.g. 룰렛) starts that widget from its defaults.
for (const key of Object.keys(initial) as (keyof WidgetSettingsMap)[]) {
  (widgetStore as Record<string, unknown>)[key] ??= structuredClone(initial[key]);
}

/** A copy of one widget's settings; fields added later (e.g. 치지직 최근알림 문구) read with their defaults. */
export function readWidget<K extends EditableWidgetKey>(key: K): WidgetSettingsMap[K] {
  const copy = structuredClone(widgetStore[key]);
  if (key === "RECENT") {
    const recent = copy as WidgetSettingsMap["RECENT"];
    recent.templates = { ...DEFAULT_WIDGET_SETTINGS.RECENT.templates, ...recent.templates };
  }
  if (key === "ALERT") {
    // 후원 알림 디자인 saved before 알림 사운드 · 시그니처 음원 받는 방식 (2026-10-28): none · 기존 방식.
    return { ...DEFAULT_WIDGET_SETTINGS.ALERT, ...copy } as WidgetSettingsMap[K];
  }
  if (key === "RANKING") {
    // 후원랭킹 saved before 랭킹제외 (2026-10-28): nobody left out.
    (copy as WidgetSettingsMap["RANKING"]).excluded ??= [];
  }
  if (key === "ROULETTE") {
    // 룰렛 settings saved before 결과 자동 노출 read with its default.
    return { ...DEFAULT_WIDGET_SETTINGS.ROULETTE, ...copy } as WidgetSettingsMap[K];
  }
  if (key === "QR" || key === "TOTAL" || key === "RECENT" || key === "EVENT" || key === "RANKING" || key === "MINI") {
    // Saved before 오버레이 테마 (2026-10-08): 전체 테마 따르기, and no 배경 카드 so the look stays as it was.
    const themed = copy as { theme?: string; card?: boolean };
    themed.theme ??= "INHERIT";
    if (key !== "QR" && key !== "EVENT") themed.card ??= false;
  }
  if (key === "QUEST" || key === "VOTE" || key === "ROULETTE" || key === "WALLPAPER") {
    (copy as { theme?: string }).theme ??= "INHERIT";
  }
  if (key === "GACHA") {
    (copy as WidgetSettingsMap["GACHA"]).overlayTheme ??= "INHERIT";
  }
  if (key === "GOAL") {
    // 후원목표 saved before 오버레이 테마 · 모양 · 두 번째 목표 (2026-10-08) reads with those defaults (its colors kept).
    const d = DEFAULT_WIDGET_SETTINGS.GOAL;
    const goal = copy as WidgetSettingsMap["GOAL"];
    goal.theme ??= d.theme;
    goal.shape ??= d.shape;
    goal.customColors ??= true;
    goal.second ??= structuredClone(d.second);
    goal.alternateSec ??= d.alternateSec;
    // 자동 증량 (2026-10-23): off for goals saved before it.
    goal.autoRaise ??= 0;
  }
  if (key === "CHAT") {
    // 채팅창 saved before 오버레이 테마 (2026-10-08) follows the 전체 테마.
    (copy as WidgetSettingsMap["CHAT"]).theme ??= "INHERIT";
  }
  if (key === "RANKING") {
    // Settings saved before 랭킹 종류 (2026-10-06) read as 후원자 랭킹, like the parser does.
    (copy as WidgetSettingsMap["RANKING"]).board ??= "DONOR";
  }
  if (key === "VOTE") {
    // Presets saved before 무료 투표 (2026-10-04) carried a price and 무료 투표권; drop them.
    const vote = copy as WidgetSettingsMap["VOTE"];
    vote.presets = vote.presets.map(({ id, name, color, durationSec, items }) => ({ id, name, color, durationSec, items }));
  }
  return copy;
}

/** An 알림 사운드 deleted from the library reads as none (2026-10-28). */
export function withLiveAlertSound(s: WidgetSettingsMap["ALERT"]): WidgetSettingsMap["ALERT"] {
  return s.soundId && !findAsset(s.soundId, "SOUND") ? { ...s, soundId: null } : s;
}

/** 최고 후원 수동 수정 (2026-10-28): the entry set by hand and when — within its 기간 it stands for every donation before it. */
export type TopDonationOverride = { donor: string; fnAmount: number; at: string };
const state = globalThis as typeof globalThis & { __ssumnationMockWidgetStateV1?: { topDonation: TopDonationOverride | null } };
/** Widget state that is not a setting (server-only, like the settings store). */
export const widgetState = (state.__ssumnationMockWidgetStateV1 ??= { topDonation: null });
