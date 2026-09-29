/**
 * Platform donation (SOOP · FlexTV 머니 후원) — core types shared by the client and the server.
 * Figma 817:9017–9741 (SOOP) · 817:8317–8948 (FlexTV) · 817:7699 · 817:7872.
 *
 * These are Funation's own shapes. Platform DTOs never leave the adapters (CLAUDE.md §9), and the
 * two platforms are not assumed to have the same capabilities. The user always pays in FN; prices
 * per product are server-side mock data (Figma samples) — the FN ↔ platform-currency rate is TBD.
 */

export type PlatformKey = "SOOP" | "FLEXTV";

export const PLATFORMS: Record<PlatformKey, { slug: string; name: string; creatorWord: string; tagline: string; searchPlaceholder: string }> = {
  SOOP: {
    slug: "soop",
    name: "SOOP",
    creatorWord: "스트리머",
    tagline: "좋아하는 스트리머에게 별풍선으로 마음을 전해보세요.",
    searchPlaceholder: "스트리머 닉네임 또는 ID 검색"
  },
  FLEXTV: {
    slug: "flextv",
    name: "FlexTV",
    creatorWord: "호스트",
    tagline: "라이브의 순간을 하트와 응원으로 더 특별하게 만들어보세요.",
    searchPlaceholder: "호스트 닉네임 또는 ID 검색"
  }
};

export const platformFromSlug = (slug: string): PlatformKey | null =>
  (Object.keys(PLATFORMS) as PlatformKey[]).find((k) => PLATFORMS[k].slug === slug) ?? null;

export type PlatformCreator = {
  id: string;
  nickname: string;
  handle: string;
  live: boolean;
  /** Broadcast title while live, otherwise a last-broadcast note. */
  statusText: string;
  /** Current viewers, when the platform exposes it (TBD per platform). */
  viewers: number | null;
  avatarColor: string;
};

export type PlatformProduct = {
  id: string;
  label: string;
  /** Price in FN (server catalog). `null` for the custom-amount product. */
  priceFn: number | null;
  icon: string;
  /** Custom amount bounds for 직접 입력 (FlexTV). Sample bounds, TBD. */
  custom?: { minFn: number; maxFn: number };
};

export type PlatformHome = {
  platform: PlatformKey;
  balance: number;
  recent: PlatformCreator[];
  popular: PlatformCreator[];
};

export type PlatformCreatorDetail = {
  platform: PlatformKey;
  balance: number;
  creator: PlatformCreator;
  products: PlatformProduct[];
};

export const MESSAGE_MAX = 100;

export type PlatformQuote =
  | { status: "OK"; priceFn: number; balance: number; afterFn: number; sufficient: boolean; productLabel: string }
  | { status: "INVALID" | "NOT_FOUND" | "UNAVAILABLE" | "UNAUTHORIZED" };

export type PlatformDonationInput = {
  platform: PlatformKey;
  creatorId: string;
  productId: string;
  /** Only for the custom-amount product. */
  customFn?: number;
  message: string;
  /** Generated once per confirmation; the same key never debits twice. */
  idempotencyKey: string;
};

export type PlatformDonationResult =
  | {
      status: "COMPLETED";
      /** Funation Transaction ID. */
      transactionId: string;
      /** The platform's transaction id (External Transaction ID). */
      externalTransactionId: string;
      creatorName: string;
      productLabel: string;
      fnAmount: number;
      balance: number;
    }
  /** The platform did not confirm in time; FN stays held until the result is known (TBD). */
  | { status: "PENDING"; transactionId: string }
  /** Nothing was debited. */
  | { status: "FAILED"; reason: "API_ERROR" | "UNAVAILABLE" | "NOT_FOUND" }
  | { status: "INSUFFICIENT_FN"; balance: number; required: number }
  /** The same key is still being processed (중복 요청). */
  | { status: "IN_PROGRESS" }
  | { status: "CONFLICT" | "INVALID" | "UNAUTHORIZED" };
