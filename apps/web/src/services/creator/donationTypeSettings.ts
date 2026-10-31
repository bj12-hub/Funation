import { getMockDonationCatalog, type MiniColor } from "@/services/donations/donationCatalog";
import { GACHA_MAX, GACHA_NAME_MAX, GACHA_PRIZES_MAX, ROULETTE_DAILY_LIMIT_MAX, ROULETTE_ITEMS_MAX, ROULETTE_ITEMS_MIN, ROULETTE_ITEM_MAX_CHARS } from "./widgetSettingsTypes";

/**
 * 후원 종류 설정 with FLEXTV (phase 6; code-first): the streamer's 미니 · 위시리스트 · 그림 · 룰렛 · 뽑기, kept by FLEXTV
 * (docs/development/flextv-ssumnation-api.md §5). Client-safe: the screen shows the same errors the server returns.
 * The limits are the mock studio's (widgetSettingsTypes.ts) and 미니 stays under 1,000 FN (2026-10-09 결정).
 */

export const MINI_MAX_FN = 999;
export const PRICE_MAX = 100_000_000;
export const WISHLIST_MAX = 20;
export const WISHLIST_NAME_MAX = 20;
export const WISHLIST_NOTE_MAX = 40;
/** 그림 · 퀘스트 titles (the mock catalog's `game.maxText`). */
export const GAME_TITLE_MAX = 50;
export const MINI_TEXT_MAX = 30;
/** 퀘스트 제한시간 a streamer allows, in minutes (the mock catalog's 60-minute `game.maxTimeSec`). */
export const QUEST_TIME_MIN = { min: 1, max: 60 } as const;

/** The 미니 colors a streamer can offer: Ssumnation's palette. */
export const MINI_PALETTE: MiniColor[] = getMockDonationCatalog().miniColors;

export type WishlistDraft = { id: string | null; emoji: string; name: string; price: number; note: string; inStock: boolean };
export type GachaPrizeDraft = { name: string; blank: boolean; percent: number | null; left: number | null };
export type GachaDraft = { id: string | null; enabled: boolean; name: string; price: number; mode: "PROBABILITY" | "STOCK"; limit: number | null; prizes: GachaPrizeDraft[] };

export type DonationTypeSettings = {
  mini: { enabled: boolean; minAmount: number; maxAmount: number; colorIds: string[] };
  wishlist: WishlistDraft[];
  /** 그림 · 퀘스트's shared minimum, as in Ssumnation's catalog. */
  game: { minAmount: number };
  drawing: { enabled: boolean };
  /** `maxTimeSec`: the longest 제한시간 a supporter may set; `allowExtension`: 리모컨 시간 연장. */
  quest: { enabled: boolean; maxTimeSec: number; allowExtension: boolean };
  roulette: { enabled: boolean; minAmount: number; dailyLimit: number; items: { name: string; percent: number }[] };
  gacha: GachaDraft[];
};

/** Where a streamer who never set anything starts (all off). */
export const DEFAULT_TYPE_SETTINGS: DonationTypeSettings = {
  mini: { enabled: false, minAmount: 100, maxAmount: MINI_MAX_FN, colorIds: MINI_PALETTE.map((c) => c.id) },
  wishlist: [],
  game: { minAmount: 1_000 },
  drawing: { enabled: false },
  quest: { enabled: false, maxTimeSec: 3_600, allowExtension: true },
  roulette: { enabled: false, minAmount: 1_000, dailyLimit: 0, items: [{ name: "꽝", percent: 50 }, { name: "노래 한 곡", percent: 50 }] },
  gacha: []
};

export type SaveTypeSettingsResult = { status: "SAVED"; settings: DonationTypeSettings } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" | "UNKNOWN" };

const whole = (value: unknown, min: number, max: number) => (typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : null);
const label = (value: unknown, max: number) => (typeof value === "string" && value.trim() && value.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : null);
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The form as the server reads it. A section that is off keeps its values (checked loosely) for the next time. */
export function parseTypeSettings(input: unknown): DonationTypeSettings | { invalid: string } {
  if (!isRecord(input)) return { invalid: "잘못된 요청이에요. 다시 시도해 주세요." };
  const m = isRecord(input.mini) ? input.mini : {};
  const miniMin = whole(m.minAmount, 1, MINI_MAX_FN);
  const miniMax = whole(m.maxAmount, 1, MINI_MAX_FN);
  const colorIds = Array.isArray(m.colorIds) ? [...new Set(m.colorIds.filter((c): c is string => typeof c === "string" && MINI_PALETTE.some((p) => p.id === c)))] : [];
  if (miniMin === null || miniMax === null || miniMax < miniMin) return { invalid: `미니 후원 금액은 1 ~ ${MINI_MAX_FN} FN 사이에서, 최소가 최대보다 크지 않게 정해 주세요.` };
  if (m.enabled === true && colorIds.length === 0) return { invalid: "미니 후원 글자 색을 하나 이상 골라 주세요." };

  const wishlistIn = Array.isArray(input.wishlist) ? input.wishlist : [];
  if (wishlistIn.length > WISHLIST_MAX) return { invalid: `위시리스트는 ${WISHLIST_MAX}개까지 등록할 수 있어요.` };
  const wishlist: WishlistDraft[] = [];
  for (const w of wishlistIn) {
    if (!isRecord(w)) return { invalid: "위시리스트 항목을 다시 확인해 주세요." };
    const name = label(w.name, WISHLIST_NAME_MAX);
    const price = whole(w.price, 1, PRICE_MAX);
    const note = typeof w.note === "string" && w.note.trim().length <= WISHLIST_NOTE_MAX ? w.note.trim() : null;
    if (!name || price === null || note === null) return { invalid: `위시리스트 항목은 이름(${WISHLIST_NAME_MAX}자까지)과 가격을 넣어 주세요.` };
    const emoji = typeof w.emoji === "string" && w.emoji.trim() && [...w.emoji.trim()].length <= 2 ? w.emoji.trim() : "🎁";
    wishlist.push({ id: typeof w.id === "string" && /^[\w-]{1,40}$/.test(w.id) ? w.id : null, emoji, name, price, note, inStock: w.inStock !== false });
  }

  const gameIn = isRecord(input.game) ? input.game : {};
  const gameMin = whole(gameIn.minAmount, 1, PRICE_MAX);
  if (gameMin === null) return { invalid: "그림 · 퀘스트 후원 최소 금액을 넣어 주세요." };
  const d = isRecord(input.drawing) ? input.drawing : {};
  const q = isRecord(input.quest) ? input.quest : {};
  const questTime = whole(q.maxTimeSec, QUEST_TIME_MIN.min * 60, QUEST_TIME_MIN.max * 60);
  if (questTime === null || questTime % 60 !== 0) return { invalid: `퀘스트 최대 제한시간은 ${QUEST_TIME_MIN.min} ~ ${QUEST_TIME_MIN.max}분으로 넣어 주세요.` };

  const r = isRecord(input.roulette) ? input.roulette : {};
  const rouletteMin = whole(r.minAmount, 1, PRICE_MAX);
  const dailyLimit = whole(r.dailyLimit, 0, ROULETTE_DAILY_LIMIT_MAX);
  const itemsIn = Array.isArray(r.items) ? r.items : [];
  const items = itemsIn.flatMap((i) => {
    const name = isRecord(i) ? label(i.name, ROULETTE_ITEM_MAX_CHARS) : null;
    const percent = isRecord(i) ? whole(i.percent, 1, 100) : null;
    return name && percent !== null ? [{ name, percent }] : [];
  });
  if (rouletteMin === null || dailyLimit === null) return { invalid: `룰렛 참여 금액과 하루 참여 횟수(0 ~ ${ROULETTE_DAILY_LIMIT_MAX}회, 0 = 제한 없음)를 넣어 주세요.` };
  if (items.length !== itemsIn.length || items.length < ROULETTE_ITEMS_MIN || items.length > ROULETTE_ITEMS_MAX)
    return { invalid: `룰렛 항목은 ${ROULETTE_ITEMS_MIN} ~ ${ROULETTE_ITEMS_MAX}개, 이름은 ${ROULETTE_ITEM_MAX_CHARS}자까지, 확률은 1% 이상으로 넣어 주세요.` };
  if (r.enabled === true && items.reduce((s, i) => s + i.percent, 0) !== 100) return { invalid: "룰렛 항목 확률의 합이 100%가 되게 맞춰 주세요." };

  const gachaIn = Array.isArray(input.gacha) ? input.gacha : [];
  if (gachaIn.length > GACHA_MAX) return { invalid: `뽑기는 ${GACHA_MAX}개까지 만들 수 있어요.` };
  const gacha: GachaDraft[] = [];
  for (const g of gachaIn) {
    if (!isRecord(g)) return { invalid: "뽑기를 다시 확인해 주세요." };
    const name = label(g.name, GACHA_NAME_MAX);
    const price = whole(g.price, 1, PRICE_MAX);
    const mode = g.mode === "STOCK" ? "STOCK" : "PROBABILITY";
    const limit = g.limit === null || g.limit === undefined ? null : whole(g.limit, 1, 100);
    const prizesIn = Array.isArray(g.prizes) ? g.prizes : [];
    if (!name || price === null || (g.limit !== null && g.limit !== undefined && limit === null)) return { invalid: `뽑기 이름(${GACHA_NAME_MAX}자까지)과 가격, 1인 하루 횟수(1 ~ 100회)를 확인해 주세요.` };
    if (prizesIn.length === 0 || prizesIn.length > GACHA_PRIZES_MAX) return { invalid: `'${name}' 뽑기의 상품은 1 ~ ${GACHA_PRIZES_MAX}개로 넣어 주세요.` };
    const prizes: GachaPrizeDraft[] = [];
    for (const p of prizesIn) {
      const prizeName = isRecord(p) ? label(p.name, GACHA_NAME_MAX) : null;
      const percent = isRecord(p) && mode === "PROBABILITY" ? whole(p.percent, 1, 100) : null;
      const left = isRecord(p) && mode === "STOCK" ? whole(p.left, 0, 1_000_000) : null;
      if (!prizeName || (mode === "PROBABILITY" ? percent === null : left === null)) return { invalid: `'${name}' 뽑기의 상품 이름과 ${mode === "PROBABILITY" ? "확률" : "재고"}를 확인해 주세요.` };
      prizes.push({ name: prizeName, blank: isRecord(p) && p.blank === true, percent, left });
    }
    if (g.enabled === true && mode === "PROBABILITY" && prizes.reduce((s, p) => s + (p.percent ?? 0), 0) !== 100) return { invalid: `'${name}' 뽑기 상품 확률의 합이 100%가 되게 맞춰 주세요.` };
    gacha.push({ id: typeof g.id === "string" && /^[\w-]{1,40}$/.test(g.id) ? g.id : null, enabled: g.enabled === true, name, price, mode, limit, prizes });
  }

  return {
    mini: { enabled: m.enabled === true, minAmount: miniMin, maxAmount: miniMax, colorIds },
    wishlist,
    game: { minAmount: gameMin },
    drawing: { enabled: d.enabled === true },
    quest: { enabled: q.enabled === true, maxTimeSec: questTime, allowExtension: q.allowExtension === true },
    roulette: { enabled: r.enabled === true, minAmount: rouletteMin, dailyLimit, items },
    gacha
  };
}
