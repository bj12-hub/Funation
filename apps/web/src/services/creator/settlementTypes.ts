/**
 * Client-safe settlement types and constants (정산설정, Figma 429:4 · 433:* · 437:* · 443:* · 452:*).
 *
 * Settlement policy — minimum amount, schedule, fees, tax treatment, the identity verification
 * provider and the handling of overseas residents — is not approved yet (TBD). Nothing here encodes
 * those rules. Decided: 정산 신청 requires 본인인증 (2026-10-06, see SettlementGate).
 */

export type ResidenceCountry = "KR" | "OTHER";

/** 회원 유형 (429:152). */
export const MEMBER_TYPES = [
  { key: "INDIVIDUAL", label: "개인 (대한민국 국민)", formLabel: "개인 (대한민국 국민)" },
  { key: "FOREIGN_RESIDENT", label: "개인 (국내거주 외국인)", formLabel: "개인 (대한민국 거주 외국인)" },
  { key: "SOLE_PROPRIETOR", label: "개인사업자", formLabel: "개인사업자" },
  { key: "CORPORATION", label: "법인 (법인, 단체)", formLabel: "법인 (법인사업자, 단체)" }
] as const;
export type MemberType = (typeof MEMBER_TYPES)[number]["key"];

export const isMemberType = (v: unknown): v is MemberType => MEMBER_TYPES.some((t) => t.key === v);
export const memberTypeLabel = (t: MemberType) => MEMBER_TYPES.find((m) => m.key === t)?.label ?? t;

/** 대한민국 이외 questionnaire (452:4 · 452:47). */
export const OVERSEAS_QUESTIONS = [
  "대한민국을 제외한 국가의 국적 혹은 영주권을 소유하고 있으십니까?",
  "대한민국에 연간 183일 이상 체류하고 계십니까?",
  "대한민국 내 시중은행에 본인명의의 계좌를 보유하고 계십니까?",
  "썸네이션 이용을 통한 정산금액을 제외하고 대한민국 국세청에 신고되는 소득이 있으십니까?"
] as const;

export type TermsResult = { status: "ACCEPTED"; memberType: MemberType } | { status: "INVALID" | "UNAUTHORIZED"; message?: string };
export type OverseasResult = { status: "RECEIVED" } | { status: "INVALID" | "UNAUTHORIZED"; message?: string };

// ── 정산 자료 등록 form (429:219 · 443:5 · 433:210 · 437:4) ─────────────────────────────

/**
 * Select options. Figma only shows the selected value of each dropdown (신한은행, 010, gmail.com,
 * 유튜브 …); the final option lists are TBD. Banks and visa codes are reference data, not policy.
 */
export const BANKS = ["신한은행", "우리은행", "KB국민은행", "하나은행", "NH농협은행", "IBK기업은행", "SC제일은행", "카카오뱅크", "토스뱅크", "케이뱅크"] as const;
export const PHONE_PREFIXES = ["010", "011", "016", "017", "018", "019"] as const;
export const EMAIL_DOMAINS = ["gmail.com", "naver.com", "daum.net", "kakao.com"] as const;
/** Confirmed platforms only (CLAUDE.md; 치지직 confirmed 2026-10-01). Figma 443:5 also lists 트위치, which is out of scope. */
export const CHANNEL_PLATFORMS = [
  { key: "YOUTUBE", label: "유튜브" },
  { key: "FLEXTV", label: "FlexTV" },
  { key: "SOOP", label: "SOOP" },
  { key: "CHZZK", label: "치지직" }
] as const;
export const NATIONALITIES = ["미국", "중국", "일본", "베트남", "필리핀", "태국", "캐나다", "기타"] as const;
export const VISA_TYPES = ["F-2 (거주)", "F-4 (재외동포)", "F-5 (영주)", "F-6 (결혼이민)", "E-7 (특정활동)", "D-2 (유학)", "기타"] as const;
/** 면세 여부 (433:210). Which activities are tax-exempt is shown as Figma helper copy only. */
export const TAX_EXEMPT_OPTIONS = ["과세사업자", "면세사업자"] as const;
/** 과세 유형 for 법인 (437:4). */
export const CORP_TAX_TYPES = ["법인 사업자", "단체"] as const;

/** Uploads accepted for 증빙 files. Size limit is a technical guard; the real limit is TBD. */
export const SETTLEMENT_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const SETTLEMENT_FILE_MAX_BYTES = 5 * 1024 * 1024;

export type SettlementFileKey = "idCopy" | "foreignIdCopy" | "bankCopy" | "bizLicense" | "accountForm" | "corpSeal";

/** Text fields each member type requires (the server enforces the same list). */
export const REQUIRED_FIELDS: Record<MemberType, string[]> = {
  INDIVIDUAL: ["name", "idFront", "idBack", "phone", "bank", "accountNo", "holder", "email", "address", "channelPlatform", "channelUrl"],
  FOREIGN_RESIDENT: ["name", "idFront", "idBack", "bank", "accountNo", "holder", "nationality", "visa", "phone", "email", "address", "channelPlatform", "channelUrl"],
  SOLE_PROPRIETOR: ["bizNo", "taxExempt", "ceoName", "bank", "accountNo", "holder", "companyName", "bizCategory", "bizItem", "phone", "email", "address", "channelPlatform", "channelUrl"],
  CORPORATION: [
    "corpTaxType",
    "bizNo",
    "companyName",
    "bank",
    "accountNo",
    "holder",
    "bizCategory",
    "bizItem",
    "ceoName",
    "phone",
    "email",
    "address",
    "channelPlatform",
    "channelUrl",
    "managerName",
    "managerTitle",
    "managerPhone",
    "managerEmail"
  ]
};

export const REQUIRED_FILES: Record<MemberType, SettlementFileKey[]> = {
  INDIVIDUAL: ["idCopy", "bankCopy"],
  FOREIGN_RESIDENT: ["foreignIdCopy", "bankCopy"],
  SOLE_PROPRIETOR: ["bizLicense", "bankCopy"],
  CORPORATION: ["bizLicense", "bankCopy", "accountForm", "corpSeal"]
};

export type RegistrationResult =
  | { status: "SUBMITTED" }
  | { status: "INVALID"; message: string; field?: string }
  | { status: "NO_TERMS" | "ALREADY_REGISTERED" | "UNAUTHORIZED" };

// ── 정산 신청 (458:4 · 469:* · 473:2 · 477:2 · 463:2) ─────────────────────────────────

/** FORFEITED = the creator withdrew and agreed to forfeit earnings waiting for settlement (2026-10-05 결정). */
export type SettlementStatus = "PENDING" | "APPROVED" | "REJECTED" | "FORFEITED";
export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = { PENDING: "승인대기", APPROVED: "승인", REJECTED: "거절", FORFEITED: "탈퇴 소멸" };

export type SettlementHistoryItem = {
  id: string;
  status: SettlementStatus;
  requestedAt: string;
  periodFrom: string;
  periodTo: string;
  amountFn: number;
  feeFn: number;
  netKrw: number;
  payoutDate: string | null;
  /** 반려 사유 from the admin review (code-first). */
  reviewNote?: string;
};

export type SettlementApplyView = {
  availableFn: number;
  /** Minimum request from the server's policy (TBD — Figma sample). Null when no minimum applies. */
  minFn: number | null;
  code: string;
  registrant: string;
  holder: string;
  bankName: string;
  accountMasked: string;
  autoSettlement: boolean;
  hasPending: boolean;
  /** Last 8 months, oldest first: month `yyyy-mm` and the amount paid out (원) for requests made that month. */
  monthly: { month: string; krw: number }[];
  recent: SettlementHistoryItem[];
};

/** Server-computed breakdown shown in 473:2 / 477:2. The browser never computes these. */
export type SettlementQuote = {
  amountFn: number;
  paymentFeeRate: number;
  paymentFeeFn: number;
  serviceFeeRate: number;
  serviceFeeFn: number;
  totalFeeFn: number;
  netKrw: number;
};

/**
 * Why 정산 신청 is closed, checked after the session: no 정산 자료 registration yet, then
 * IDENTITY_REQUIRED = 본인인증 (마이페이지) not done — 2026-10-06 결정 "필수로 막기".
 */
export type SettlementGate = "NOT_REGISTERED" | "IDENTITY_REQUIRED";

export type QuoteResult = { status: "OK"; quote: SettlementQuote } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" | SettlementGate };
export type SaveAutoResult = { status: "SAVED"; on: boolean } | { status: "INVALID" | "UNAUTHORIZED" | SettlementGate };
export type RequestResult =
  | { status: "REQUESTED"; quote: SettlementQuote; requestId: string }
  | { status: "INVALID"; message: string }
  /** CONFLICT: the Idempotency-Key was already used for a different amount. */
  | { status: "UNAUTHORIZED" | SettlementGate | "CONFLICT" };

// ── 정산 관리 (478:2 · 479:144 · 480:2) ────────────────────────────────────────────────

/** 기간 presets (478:2), calendar (lib/period presetRange, 2026-10-08 결정): 일별 = 오늘, 주별 = 이번 주, 월별 = 이번 달, 연별 = 12개월, 기간별 = 직접 입력. */
export const MANAGE_PERIODS = [
  { key: "day", label: "일별" },
  { key: "week", label: "주별" },
  { key: "month", label: "월별" },
  { key: "year", label: "연별" },
  { key: "custom", label: "기간별" }
] as const;
export type ManagePeriod = (typeof MANAGE_PERIODS)[number]["key"];
export const isManagePeriod = (v: unknown): v is ManagePeriod => MANAGE_PERIODS.some((p) => p.key === v);
export const MANAGE_PAGE_SIZE = 10;

export type SettlementManageView = {
  registrant: string;
  bankName: string;
  accountMasked: string;
  memberType: MemberType;
  period: ManagePeriod;
  from: string;
  to: string;
  items: SettlementHistoryItem[];
  page: number;
  totalPages: number;
};

export type ResetResult = { status: "RESET" } | { status: "UNAUTHORIZED" | "NOT_REGISTERED" };

/** What the settlement pages need to know about the creator's registration. Account numbers are masked. */
export type SettlementOverview = {
  registered: boolean;
  registrant: string | null;
  memberType: MemberType | null;
  bankName: string | null;
  accountMasked: string | null;
  /** 정산 준비 체크리스트 (code-first, no Figma frame). */
  checklist: SettlementChecklist;
};

export type ReviewStatus = "NOT_SUBMITTED" | "IN_REVIEW" | "APPROVED" | "REJECTED";
export const REVIEW_LABEL: Record<ReviewStatus, string> = { NOT_SUBMITTED: "미제출", IN_REVIEW: "심사 중", APPROVED: "승인", REJECTED: "반려" };

/**
 * Steps a creator completes before requesting settlement. Reference: funnation.co.kr's
 * 본인인증 → 신분증 → 계좌 checklist (docs/research/funnation-reference.md P1-4). The review workflow
 * is TBD — the mock approves submitted documents immediately.
 */
export type SettlementChecklist = {
  identityVerified: boolean;
  documentsSubmitted: boolean;
  review: ReviewStatus;
  bankRegistered: boolean;
  /** All steps done — the 정산 신청 card becomes the next action. */
  ready: boolean;
};
