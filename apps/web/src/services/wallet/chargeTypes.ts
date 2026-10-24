/**
 * FN charge flow types and display copy. Client-safe (no server-only imports);
 * the actions live in ./charge.ts.
 * Figma: 595:1869 · 672:2 · 593:1677 (form), 601:839 (결제수단변경), 595:5475 (약관),
 *        606:540 (완료), 739:28 · 739:132 · 739:236 · 739:340 · 739:444 (결제 취소)
 */

// ── Payment methods (601:839 grid) ───────────────────────────────────────────
// Brand marks are text/emoji in the design. The provider and which methods it supports are TBD;
// the server returns the ids that are actually available.

export type PaymentMethodId =
  | "SSUMNATION_PAY"
  | "NAVER_PAY"
  | "KAKAO_PAY"
  | "CARD"
  | "PAYCO"
  | "PHONE"
  | "TOSS_PAY"
  | "SAMSUNG_PAY"
  | "PHONE_EASY"
  | "CULTURELAND"
  | "VIRTUAL_ACCOUNT"
  | "TMONEY"
  | "SSG_PAY"
  | "INTERNET_BANKING"
  | "BOOK_GIFT"
  /** 무통장입금 to the site's account (FLEXTV backend): credited once the deposit is matched. */
  | "BANK_TRANSFER";

export type PaymentMethodInfo = { glyph: string; name: string; subtitle: string };

export const PAYMENT_METHODS: Record<PaymentMethodId, PaymentMethodInfo> = {
  SSUMNATION_PAY: { glyph: "", name: "썸네이션 Pay", subtitle: "펀페이" },
  NAVER_PAY: { glyph: "N", name: "네이버페이", subtitle: "네이버페이" },
  KAKAO_PAY: { glyph: "K", name: "카카오페이", subtitle: "카카오페이" },
  CARD: { glyph: "💳", name: "신용카드", subtitle: "신용카드" },
  PAYCO: { glyph: "P", name: "페이코", subtitle: "페이코" },
  PHONE: { glyph: "📱", name: "휴대폰결제", subtitle: "휴대폰결제" },
  TOSS_PAY: { glyph: "T", name: "토스페이", subtitle: "토스페이" },
  SAMSUNG_PAY: { glyph: "S", name: "삼성페이", subtitle: "삼성페이" },
  PHONE_EASY: { glyph: "⚡", name: "휴대폰(간편)", subtitle: "휴대폰결제(간편)" },
  CULTURELAND: { glyph: "C", name: "컬쳐랜드", subtitle: "컬쳐랜드 상품권" },
  VIRTUAL_ACCOUNT: { glyph: "🏦", name: "가상계좌", subtitle: "가상계좌" },
  TMONEY: { glyph: "T-money", name: "티머니", subtitle: "티머니/캐시비" },
  SSG_PAY: { glyph: "SSG", name: "SSG페이", subtitle: "SSG페이" },
  INTERNET_BANKING: { glyph: "💻", name: "인터넷뱅킹", subtitle: "인터넷뱅킹" },
  BOOK_GIFT: { glyph: "BOOK", name: "도서상품권", subtitle: "도서문화상품권" },
  BANK_TRANSFER: { glyph: "🏧", name: "무통장입금", subtitle: "무통장입금" }
};

export const PAYMENT_METHOD_IDS = Object.keys(PAYMENT_METHODS) as PaymentMethodId[];

// ── Options / quote ──────────────────────────────────────────────────────────

export type ChargePackage = { id: string; fnAmount: number; /** KRW, set by the server. */ price: number };

export type ChargeOptions = {
  /** Server balance, display-only. */
  balance: number;
  /** Whether the member already agreed to the charge terms (595:4891 appears on first use only). */
  termsAgreed: boolean;
  packages: ChargePackage[];
  /** Registered methods shown as cards (593:558); first one is preselected. */
  savedMethods: PaymentMethodId[];
  /** Methods offered in 결제수단변경. */
  availableMethods: PaymentMethodId[];
  /** Minimum custom amount in FN. */
  minAmount: number;
  /**
   * FLEXTV backend: whether the member may charge — FLEXTV asks for its 본인인증 and 만 19세 이상 (`MINOR`), and does
   * not sell to self-declared foreign members (`UNAVAILABLE`). Absent (the mock): the form is shown.
   */
  eligibility?: ChargeEligibility;
  /** FLEXTV backend: bonus FN a 무통장입금 earns, as minimum FN → percent, highest minimum first. */
  depositBonus?: { minAmount: number; percent: number }[];
};

export type ChargeEligibility = "OK" | "IDENTITY_REQUIRED" | "MINOR" | "UNAVAILABLE";

export type ChargeQuote = { status: "OK"; fnAmount: number; price: number } | { status: "INVALID"; minAmount: number };

// ── Terms (595:5475) ─────────────────────────────────────────────────────────

export type ChargeConsentKey = "guardian" | "privacy" | "payment" | "marketing";

/**
 * `href`: the 약관 · 정책 page the consent's "보기" opens (조항 목차, 본문 TBD). The 법정대리인 동의 has no document
 * yet — age rules are TBD — so its "보기" stays disabled.
 */
export const CHARGE_CONSENTS: { key: ChargeConsentKey; required: boolean; label: string; href?: string }[] = [
  { key: "guardian", required: true, label: "만 19세 미만 미성년자 법정대리인 동의" },
  { key: "privacy", required: true, label: "개인정보 제3자 제공 및 수집·이용 동의", href: "/terms/privacy" },
  { key: "payment", required: true, label: "결제 서비스 이용약관 및 환불 정책 동의", href: "/terms/refund" },
  { key: "marketing", required: false, label: "이벤트 혜택 및 마케팅 알림 수신 동의", href: "/terms/marketing" }
];

// ── Charge request / result ──────────────────────────────────────────────────

export type ChargeAmountInput = { packageId: string } | { customAmount: number };

export type ChargeRequest = {
  amount: ChargeAmountInput;
  methodId: PaymentMethodId;
  /** Generated once per submission in the browser; the same key never charges twice. */
  idempotencyKey: string;
  /** 입금자명, for BANK_TRANSFER only. */
  depositorName?: string;
};

export type ChargeErrorCode =
  | "PAY-STOP-401"
  | "BANK-MAINT-503"
  | "LIMIT-OVER-429"
  | "METHOD-LOCK-403"
  | "SYSTEM-TEMP-500"
  /** FLEXTV backend (code-first): a 무통장입금 request of the same amount is still waiting for its deposit. */
  | "DEPOSIT-WAITING-409";

export type ChargeResult =
  | {
      status: "COMPLETED";
      transactionId: string;
      fnAmount: number;
      price: number;
      methodId: PaymentMethodId;
      /** Balance after the charge, from the server. */
      balance: number;
    }
  | { status: "FAILED"; code: ChargeErrorCode }
  /**
   * FLEXTV backend: the payment continues in the provider's window (`payUrl`, opened by the browser); the result comes
   * from `checkChargeStatus(checkoutId)` once the provider told FLEXTV.
   */
  | { status: "PAYMENT_STARTED"; checkoutId: string; payUrl: string; fnAmount: number; price: number; methodId: PaymentMethodId }
  /** FLEXTV backend: a 무통장입금 request; the FN arrive once the deposit to `account` is matched. */
  | {
      status: "DEPOSIT_REQUESTED";
      fnAmount: number;
      price: number;
      bonusFn: number;
      depositorName: string;
      /** Null when FLEXTV did not say (the member is pointed to 고객센터). */
      account: { bank: string; number: string; holder: string } | null;
    }
  /** FLEXTV backend: the member may not charge yet (ChargeOptions.eligibility). */
  | { status: "NOT_ELIGIBLE"; eligibility: Exclude<ChargeEligibility, "OK"> }
  /** Same key is still being processed. */
  | { status: "IN_PROGRESS" }
  /** Same key was used with a different request. */
  | { status: "CONFLICT" }
  | { status: "INVALID" | "TERMS_REQUIRED" | "UNAUTHORIZED" };

/** `checkChargeStatus`: where a payment started in the provider's window stands. */
export type ChargeStatusResult =
  | Extract<ChargeResult, { status: "COMPLETED" }>
  /** Not finished — still paying, or the window was closed without paying. */
  | { status: "PENDING" }
  | { status: "FAILED"; code: ChargeErrorCode }
  | { status: "UNAUTHORIZED" | "INVALID" };

/** Methods whose payment continues in the provider's window (FLEXTV backend: Payletter). */
export const WINDOW_PAYMENT_METHODS: readonly PaymentMethodId[] = ["KAKAO_PAY", "CARD", "PHONE"];

/** Figma 739:* 결제 취소 variants. `primary` is the right (purple) button. */
export const CHARGE_ERRORS: Record<
  ChargeErrorCode,
  { title: string; lines: [string, string]; secondary: "CLOSE" | "SUPPORT"; primary: "CHANGE_METHOD" | "RETRY"; primaryLabel: string }
> = {
  "PAY-STOP-401": {
    title: "거래가 정지되었습니다",
    lines: ["금융기관 또는 결제수단에서 거래를 정지한 상태입니다.", "금융기관에 문의하거나 다른 결제수단을 이용해 주세요."],
    secondary: "CLOSE",
    primary: "CHANGE_METHOD",
    primaryLabel: "다른 결제수단"
  },
  "BANK-MAINT-503": {
    title: "은행 점검 시간입니다",
    lines: ["현재 은행 시스템 점검으로 결제를 진행할 수 없습니다.", "점검 종료 후 다시 시도해 주세요."],
    secondary: "CLOSE",
    primary: "RETRY",
    primaryLabel: "다시 시도"
  },
  "LIMIT-OVER-429": {
    title: "결제 한도를 초과했습니다",
    lines: ["등록된 결제수단의 일 또는 월 결제 한도를 초과했습니다.", "한도를 확인하거나 다른 결제수단을 이용해 주세요."],
    secondary: "CLOSE",
    primary: "CHANGE_METHOD",
    primaryLabel: "다른 결제수단"
  },
  "METHOD-LOCK-403": {
    title: "결제수단을 사용할 수 없습니다",
    lines: ["계좌 또는 결제수단의 등록 정보 확인이 필요합니다.", "등록 정보를 확인하거나 다른 결제수단을 이용해 주세요."],
    secondary: "CLOSE",
    primary: "CHANGE_METHOD",
    primaryLabel: "정보 확인"
  },
  "SYSTEM-TEMP-500": {
    title: "일시적인 오류가 발생했습니다",
    lines: ["결제 시스템 연결이 원활하지 않아 결제가 취소되었습니다.", "잠시 후 다시 시도하거나 고객센터로 문의해 주세요."],
    secondary: "SUPPORT",
    primary: "RETRY",
    primaryLabel: "다시 시도"
  },
  "DEPOSIT-WAITING-409": {
    title: "입금 대기 중인 요청이 있습니다",
    lines: ["같은 금액의 무통장입금 요청이 입금을 기다리고 있습니다.", "입금을 마치거나 다른 금액 · 결제수단으로 충전해 주세요."],
    secondary: "CLOSE",
    primary: "CHANGE_METHOD",
    primaryLabel: "다른 결제수단"
  }
};
