/**
 * Platform donation (SOOP · FlexTV 머니 후원) — core types shared by the client and the server.
 * Figma 817:9017–9741 (SOOP) · 817:8317–8948 (FlexTV) · 817:7699 · 817:7872.
 *
 * These are Ssumnation's own shapes. Platform DTOs never leave the adapters (CLAUDE.md §9), and the
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

// ── 후원 내역 (817:8038 · 817:8223) ───────────────────────────────────────────────

/** Direct = donations made inside Ssumnation (creator room). Assumption — the Figma "Direct" tab is undefined (TBD). */
export type HistorySource = PlatformKey | "DIRECT";
export const HISTORY_TABS = [
  { key: "all", label: "전체" },
  { key: "soop", label: "SOOP" },
  { key: "flextv", label: "FlexTV" },
  { key: "direct", label: "Direct" }
] as const;
export type HistoryTab = (typeof HISTORY_TABS)[number]["key"];
export const HISTORY_PERIODS = [
  { key: "30", label: "최근 30일" },
  { key: "90", label: "최근 90일" },
  { key: "all", label: "전체 기간" }
] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number]["key"];
/** 최신순 / 오래된순 (funnation 참고, 2026-10-06 결정). */
export const HISTORY_SORTS = [
  { key: "newest", label: "최신순" },
  { key: "oldest", label: "오래된순" }
] as const;
export type HistorySort = (typeof HISTORY_SORTS)[number]["key"];
/** Rows the list shows (pagination size is TBD); 결과 건수 · 합계 cover every match. */
export const HISTORY_LIST_MAX = 50;

export type HistoryStatus = "COMPLETED" | "PROCESSING" | "FAILED" | "REFUNDING" | "REFUNDED";
export const HISTORY_STATUS_LABEL: Record<HistoryStatus, string> = {
  COMPLETED: "완료",
  PROCESSING: "처리중",
  FAILED: "실패",
  REFUNDING: "환불중",
  REFUNDED: "환불완료"
};
export const SOURCE_LABEL: Record<HistorySource, string> = { SOOP: "SOOP", FLEXTV: "FlexTV", DIRECT: "Direct" };

export type HistoryItem = {
  transactionId: string;
  externalTransactionId: string | null;
  source: HistorySource;
  creatorName: string;
  productLabel: string;
  fnAmount: number;
  status: HistoryStatus;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
};

export type HistoryView = {
  balance: number;
  tab: HistoryTab;
  period: HistoryPeriod;
  status: HistoryStatus | "all";
  q: string;
  sort: HistorySort;
  items: HistoryItem[];
  /** Every matching transaction (the list stops at HISTORY_LIST_MAX). */
  total: number;
  /** FN of the matching 완료 transactions — failed or refunded ones moved no FN to the creator. */
  completedFn: number;
  selected: HistoryItem | null;
};

export type PlatformDonationResult =
  | {
      status: "COMPLETED";
      /** Ssumnation Transaction ID. */
      transactionId: string;
      /**
       * The platform's transaction id (External Transaction ID); null when an operator decided a PENDING donation 성공
       * in 확인 중 후원 without the platform returning one.
       */
      externalTransactionId: string | null;
      creatorName: string;
      productLabel: string;
      fnAmount: number;
      balance: number;
    }
  /**
   * The platform did not confirm in time; FN stays held until the result is known: the server re-checks it for 24 hours
   * (the same key re-checks too), then an operator decides it (2026-10-08 결정). The same key then answers with the result.
   */
  | { status: "PENDING"; transactionId: string }
  /** Nothing was debited. */
  | { status: "FAILED"; reason: "API_ERROR" | "UNAVAILABLE" | "NOT_FOUND" }
  | { status: "INSUFFICIENT_FN"; balance: number; required: number }
  /** The same key is still being processed (중복 요청). */
  | { status: "IN_PROGRESS" }
  | { status: "CONFLICT" | "INVALID" | "UNAUTHORIZED" };
