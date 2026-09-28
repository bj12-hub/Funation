/**
 * Per-creator donation catalog: types, minimums, voices, signatures, wishlist, mini colors.
 * Figma: 851:4546 (일반) · 851:4665 (미니) · 851:4788 (영상) · 851:4929 (시그니처) · 875:1815 (시그니처 전체보기)
 *        · 851:5054 (위시) · 851:5174 (럭키박스)
 *
 * Client-safe: client components import the types only. Prices and minimums are server-owned
 * display data; the donation action re-reads them from the server copy (TBD policies are flagged).
 */

export type DonationTypeKey = "TEXT" | "MINI" | "VIDEO" | "SIGNATURE" | "WISHLIST" | "LUCKYBOX";

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
};

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
    // TODO: LuckyBox panel (851:5174 · 875:*) is a separate change.
    { key: "LUCKYBOX", emoji: "🎲", label: "럭키박스", title: "럭키박스 후원", available: false }
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
  ]
};
