/**
 * Client-safe settlement types and constants (정산설정, Figma 429:4 · 433:* · 437:* · 443:* · 452:*).
 *
 * Settlement policy — minimum amount, schedule, fees, tax treatment, identity verification and the
 * handling of overseas residents — is not approved yet (TBD). Nothing here encodes those rules.
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
  "Funation 이용을 통한 정산금액을 제외하고 대한민국 국세청에 신고되는 소득이 있으십니까?"
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
/** Confirmed platforms only (CLAUDE.md). Figma 443:5 also lists 트위치 · 치지직, which are out of scope. */
export const CHANNEL_PLATFORMS = [
  { key: "YOUTUBE", label: "유튜브" },
  { key: "FLEXTV", label: "FlexTV" },
  { key: "SOOP", label: "SOOP" }
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

/** What the settlement pages need to know about the creator's registration. Account numbers are masked. */
export type SettlementOverview = {
  registered: boolean;
  registrant: string | null;
  memberType: MemberType | null;
  bankName: string | null;
  accountMasked: string | null;
};
