/**
 * Per-creator donation catalog: types, minimums, voices, signatures, wishlist, mini colors.
 * Figma: 851:4546 (일반) · 851:4665 (미니) · 851:4788 (영상) · 851:4929 (시그니처) · 875:1815 (시그니처 전체보기)
 *        · 851:5054 (위시) · 851:5174 (럭키박스)
 *
 * Client-safe: client components import the types only. Prices and minimums are server-owned
 * display data; the donation action re-reads them from the server copy (TBD policies are flagged).
 */

import { DEFAULT_WIDGET_SETTINGS, type RouletteSettings } from "@/services/creator/widgetSettingsTypes";

export type DonationTypeKey =
  | "TEXT"
  | "MINI"
  | "VIDEO"
  | "SIGNATURE"
  | "WISHLIST"
  | "LUCKYBOX"
  | "ROULETTE"
  | "QUEST"
  | "DRAWING"
  | "QUIZ_CHOICE"
  | "QUIZ_INITIAL"
  | "QUIZ_DRAWING";

export type DonationTypeInfo = {
  key: DonationTypeKey;
  emoji: string;
  label: string;
  title: string;
  /** Types whose panel is not built yet render a DISABLED state. */
  available: boolean;
};

export type Voice = { id: string; emoji: string; name: string; description: string };

export type Signature = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  /** The member's own ★ mark. */
  favorite: boolean;
  /** Server-side popularity rank (1 = most popular). */
  rank: number;
};

export type WishlistItem = { id: string; emoji: string; name: string; price: number; note: string; inStock: boolean };

export type MiniColor = { id: string; label: string; hex: string };

export type LuckyTierTone = "silver" | "gold" | "emerald" | "royal";

export type LuckyTier = {
  key: string;
  /** Shown on the button, e.g. "GOLD" → "GOLD BOX 5,000 FN 후원하기". */
  label: string;
  /** Lowest amount (FN) for this tier; the tier applies up to the next tier's minimum. */
  min: number;
  emoji: string;
  boxEmoji: string;
  tone: LuckyTierTone;
  /** Grade box copy when this tier is active; `null` uses the default explanation. */
  headline: string | null;
  description: string | null;
};

export type LuckyBoxConfig = {
  minAmount: number;
  maxAmount: number;
  minBoxes: number;
  maxBoxes: number;
  presets: number[];
  tiers: LuckyTier[];
  /** Published draw ranges and odds (851:5231). */
  odds: { range: string; percent: number }[];
  terms: { title: string; body: string }[];
};

export type DonationCatalog = {
  types: DonationTypeInfo[];
  /** Minimum FN per donation type. Design shows 1,000 (일반) and 100 (미니); others TBD. */
  minAmount: Record<"TEXT" | "MINI" | "VIDEO", number>;
  /** Max characters for free text. TBD — 100 follows the existing message field; 30 for mini is an assumption. */
  maxLength: { message: number; mini: number };
  voices: Voice[];
  signatures: Signature[];
  wishlist: WishlistItem[];
  miniColors: MiniColor[];
  luckyBox: LuckyBoxConfig;
  /**
   * 룰렛 from the creator's 룰렛 settings (2026-10-04 결정: 당첨은 크리에이터 상품, FN 지급 없음). Items and
   * percents are shown before paying; the server draws.
   */
  roulette: { enabled: boolean; minAmount: number; dailyLimit: number; items: { name: string; percent: number }[] };
  /** Quest, drawing and quiz (867:*). Minimum and limits are TBD. */
  game: { minAmount: number; maxTimeSec: number; quizOptions: { min: number; max: number }; maxText: number };
};

/** What the donation panel shows of the 룰렛 settings. */
export const rouletteOffer = (s: RouletteSettings): DonationCatalog["roulette"] => ({
  enabled: s.enabled,
  minAmount: s.minAmount,
  dailyLimit: s.dailyLimit,
  items: s.items.map(({ name, percent }) => ({ name, percent }))
});

export function getMockDonationCatalog(): DonationCatalog {
  return MOCK_CATALOG;
}

// ── Mock data: Figma copy ─────────────────────────────────────────────────────

const MOCK_CATALOG: DonationCatalog = {
  types: [
    { key: "TEXT", emoji: "💬", label: "일반", title: "일반 후원", available: true },
    { key: "MINI", emoji: "⚡", label: "미니", title: "미니 후원", available: true },
    { key: "VIDEO", emoji: "🎬", label: "영상", title: "영상 후원", available: true },
    { key: "SIGNATURE", emoji: "✨", label: "시그니처", title: "시그니처 후원", available: true },
    { key: "WISHLIST", emoji: "🎁", label: "위시", title: "위시 후원", available: true },
    { key: "LUCKYBOX", emoji: "🎲", label: "럭키박스", title: "럭키박스 후원", available: true },
    // Page 2 (867:*). ☷, ㄱ and ✎ are text glyphs in the design.
    { key: "ROULETTE", emoji: "🎡", label: "룰렛", title: "룰렛 후원", available: true },
    { key: "QUEST", emoji: "🏆", label: "퀘스트", title: "퀘스트 후원", available: true },
    { key: "DRAWING", emoji: "🎨", label: "그림", title: "그림 후원", available: true },
    { key: "QUIZ_CHOICE", emoji: "☷", label: "객관식", title: "객관식 퀴즈", available: true },
    { key: "QUIZ_INITIAL", emoji: "ㄱ", label: "초성", title: "초성 퀴즈", available: true },
    { key: "QUIZ_DRAWING", emoji: "✎", label: "그림퀴즈", title: "그림 퀴즈", available: true }
  ],
  minAmount: { TEXT: 1_000, MINI: 100, VIDEO: 1_000 },
  maxLength: { message: 100, mini: 30 },
  voices: [{ id: "mina", emoji: "👧", name: "미나", description: "명랑한 보이스" }],
  // 875:1863 cards; the design says 127 items but only these 8 exist in the file.
  signatures: [
    { id: "sig-zero2", name: "제로투 Zero 2", price: 10_002, imageUrl: "/mock/room/signatures/sig-1.png", favorite: true, rank: 1 },
    { id: "sig-ankha", name: "앙카 Ankha", price: 24_444, imageUrl: "/mock/room/signatures/sig-2.png", favorite: true, rank: 2 },
    { id: "sig-holdup", name: "홀드업 Hold up", price: 10_101, imageUrl: "/mock/room/signatures/sig-3.png", favorite: false, rank: 3 },
    { id: "sig-kickdrum", name: "킥드럼 Kick drum", price: 13_600, imageUrl: "/mock/room/signatures/sig-4.png", favorite: true, rank: 4 },
    { id: "sig-terminal", name: "터미널 Terminal", price: 22_222, imageUrl: "/mock/room/signatures/sig-5.png", favorite: false, rank: 5 },
    { id: "sig-seraph", name: "세라핌 Seraph", price: 13_920, imageUrl: "/mock/room/signatures/sig-6.png", favorite: true, rank: 6 },
    { id: "sig-harahara", name: "하라하라 Harahara", price: 8_333, imageUrl: "/mock/room/signatures/sig-7.png", favorite: false, rank: 7 },
    { id: "sig-lucky", name: "Lucky Strike", price: 7_070, imageUrl: "/mock/room/signatures/sig-8.png", favorite: true, rank: 8 }
  ],
  // 851:5111. How a wishlist gift is funded (full price vs. partial) is TBD; the mock charges the price.
  wishlist: [
    { id: "wish-headphone", emoji: "🎧", name: "방송용 스튜디오 헤드폰", price: 120_000, note: "후원 가능", inStock: true },
    { id: "wish-mic", emoji: "🎤", name: "콘덴서 마이크 업그레이드", price: 85_000, note: "3일 남음", inStock: true },
    { id: "wish-light", emoji: "💡", name: "무대 조명 세트", price: 240_000, note: "목표 달성 임박", inStock: true }
  ],
  // 851:4768 swatches (colors read from the design image).
  miniColors: [
    { id: "white", label: "흰색", hex: "#ffffff" },
    { id: "pink", label: "분홍", hex: "#ec4899" },
    { id: "lavender", label: "연보라", hex: "#c4b5fd" },
    { id: "cyan", label: "하늘", hex: "#06b6d4" },
    { id: "yellow", label: "노랑", hex: "#f5bf0a" }
  ],
  // Replaced by the creator's 룰렛 settings in getDonationCatalog (signatureCore).
  roulette: rouletteOffer(DEFAULT_WIDGET_SETTINGS.ROULETTE),
  // Assumptions: 1,000 FN minimum like 일반 후원, time limit up to 60 min, 2–5 quiz options, 50-char text fields.
  game: { minAmount: 1_000, maxTimeSec: 3_600, quizOptions: { min: 2, max: 5 }, maxText: 50 },
  // 851:5231 · 875:6948–8546. The design disagrees on tiers (SILVER 1,000/GOLD 5,000/ROYAL 10,000 in the
  // base panel, EMERALD 10,000 and PREMIUM ROYAL 50,000 in the states, six ranges from 3,000 to 499,999 in
  // the guide). The mock uses the state frames; every number here is TBD.
  luckyBox: {
    minAmount: 1_000,
    maxAmount: 50_000,
    minBoxes: 2,
    maxBoxes: 5,
    presets: [1_000, 5_000, 10_000, 30_000, 50_000],
    tiers: [
      { key: "SILVER", label: "SILVER", min: 1_000, emoji: "🎁", boxEmoji: "🎁", tone: "silver", headline: null, description: null },
      { key: "GOLD", label: "GOLD", min: 5_000, emoji: "🎁", boxEmoji: "🎁", tone: "gold", headline: null, description: null },
      {
        key: "EMERALD",
        label: "EMERALD",
        min: 10_000,
        emoji: "💚",
        boxEmoji: "🧰",
        tone: "emerald",
        headline: "💚 10,000 FN · EMERALD 등급 박스로 업그레이드",
        description: "더 높은 당첨 상한과 특별한 초록 보물함이 적용됩니다."
      },
      {
        key: "ROYAL",
        label: "ROYAL",
        min: 50_000,
        emoji: "👑",
        boxEmoji: "👑",
        tone: "royal",
        headline: "👑 50,000 FN · PREMIUM ROYAL 등급 박스",
        description: "프리미엄 골드 외형과 로열 등급 추첨 범위가 적용됩니다."
      }
    ],
    odds: [
      { range: "1,000~4,999 FN", percent: 70 },
      { range: "5,000~19,999 FN", percent: 28 },
      { range: "20,000~50,000 FN", percent: 2 }
    ],
    // 875:7952 copy.
    terms: [
      { title: "1. 추첨 방법", body: "선택한 당첨 박스 수와 공개된 확률에 따라 후원 완료 시 무작위로 추첨합니다." },
      { title: "2. 당첨 금액", body: "박스 등급별 추첨 범위 안에서 FN 당첨 금액이 결정됩니다." },
      { title: "3. 확률 공개", body: "등급별 확률과 추첨 범위는 결제 전 화면에서 반드시 확인할 수 있습니다." },
      { title: "4. 취소 및 환불 제한", body: "추첨이 시작된 럭키박스 후원은 결과와 관계없이 취소 또는 환불할 수 없습니다." },
      { title: "5. 필수 동의", body: "이용약관 및 확률 안내를 확인하고 필수 동의한 뒤 후원하기를 진행해주세요." }
    ]
  }
};

/** Tier for an amount (the lowest tier below its minimum). */
export function luckyTierFor(config: LuckyBoxConfig, amount: number): LuckyTier {
  return [...config.tiers].reverse().find((t) => amount >= t.min) ?? config.tiers[0];
}
