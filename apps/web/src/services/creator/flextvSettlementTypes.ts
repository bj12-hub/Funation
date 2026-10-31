/**
 * 정산 with FLEXTV (phase 5, docs/development/flextv-backend.md "5단계"): FLEXTV's 환전 of the 렉스 a streamer received.
 * Client-safe types and FLEXTV's own rules (its 환전 page): at least 500 렉스, 사업자 정산 for 엔터 소속 streamers on
 * Wednesdays before 14:00, no cancelling on Wednesdays and Thursdays. Every ₩ figure is FLEXTV's.
 */

/** FLEXTV's minimum 환전 (its `WITHDRAW_MIN_EXCHANGE`). */
export const EXCHANGE_MIN_REX = 500;

export type ExchangeRow = {
  id: string;
  /** KST "yyyy-mm-dd hh:mm:ss". */
  at: string;
  rex: number;
  grossKrw: number;
  taxKrw: number;
  netKrw: number;
  status: number;
  /** 신청 (FLEXTV's only cancellable state). */
  cancelable: boolean;
};

export type PayoutAccount = { bankName: string; holder: string; accountMasked: string };

export type FlextvSettlementView = {
  identityVerified: boolean;
  /** FLEXTV's registered 환전 계좌 (registered and changed on FLEXTV's site). */
  account: PayoutAccount | null;
  /** 환전 가능 · 환전 진행 중 · 환전 완료 렉스. */
  exchangeable: number;
  exchanging: number;
  exchanged: number;
  minRex: number;
  /** 엔터 소속 (FLEXTV memberDiv 3): may choose 사업자 정산. */
  business: boolean;
  /** FLEXTV takes 환전 requests now. */
  open: boolean;
  /** A request still 신청 or 검토 중: FLEXTV takes one at a time. */
  openRequest: boolean;
  recent: ExchangeRow[];
};

export type ExchangeRequestResult =
  | { status: "REQUESTED"; requestId: string | null }
  | { status: "INVALID"; message: string }
  | { status: "UNAUTHORIZED" | "IDENTITY_REQUIRED" | "NO_ACCOUNT" }
  /** The key was used for another request. */
  | { status: "CONFLICT" }
  /** FLEXTV's answer was unclear and its list does not show the request yet: ask again with the same key. */
  | { status: "IN_PROGRESS" };

export type ExchangeHistoryView = { items: ExchangeRow[]; page: number; totalPages: number; total: number };

export type CancelExchangeResult = { status: "CANCELED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" | "UNKNOWN" };
