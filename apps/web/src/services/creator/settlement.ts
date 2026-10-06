"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { mockSettlement, newSettlementCode } from "./mockSettlementStore";
import {
  BANKS,
  CHANNEL_PLATFORMS,
  CORP_TAX_TYPES,
  NATIONALITIES,
  OVERSEAS_QUESTIONS,
  REQUIRED_FIELDS,
  REQUIRED_FILES,
  SETTLEMENT_FILE_MAX_BYTES,
  SETTLEMENT_FILE_TYPES,
  TAX_EXEMPT_OPTIONS,
  VISA_TYPES,
  isMemberType,
  type MemberType,
  type OverseasResult,
  type RegistrationResult,
  type SettlementOverview,
  type TermsResult
} from "./settlementTypes";

/**
 * Creator settlement (정산설정) — Figma 429:4 · 433:4 · 462:2 · 429:139 · 443:257 · 433:138 · 437:338 · 452:*.
 *
 * Server Actions re-check the session and validate input. TBD: creator role check, the approved
 * terms text and versioning, identity/account verification provider, overseas-resident policy.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Settlement API is not connected yet.");
};

export async function getSettlementOverview(): Promise<SettlementOverview | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(200);
  const r = mockSettlement.registration;
  // Review workflow is TBD: the mock treats submitted documents as approved.
  const review = r ? "APPROVED" : "NOT_SUBMITTED";
  const identityVerified = mockAccount.identity !== null;
  const bankRegistered = !!r?.accountMasked;
  return {
    registered: r !== null,
    registrant: r?.registrant ?? null,
    memberType: r?.memberType ?? null,
    bankName: r?.bankName ?? null,
    accountMasked: r?.accountMasked ?? null,
    checklist: {
      identityVerified,
      documentsSubmitted: r !== null,
      review,
      bankRegistered,
      ready: identityVerified && r !== null && review === "APPROVED" && bankRegistered
    }
  };
}

/** Required consents of 429:162 — all four must be agreed. */
export async function acceptSettlementTerms(input: unknown): Promise<TermsResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof input !== "object" || input === null) return { status: "INVALID" };
  const v = input as { memberType?: unknown; agreed?: unknown };
  if (!isMemberType(v.memberType)) return { status: "INVALID", message: "회원 유형을 선택해 주세요." };
  if (!Array.isArray(v.agreed) || v.agreed.length !== 4 || !v.agreed.every((a) => a === true)) {
    return { status: "INVALID", message: "필수 약관에 모두 동의해 주세요." };
  }
  await mockDelay(300);
  // TODO: the backend records the consent with the terms version, timestamp and member for audit.
  mockSettlement.terms = { memberType: v.memberType, acceptedAt: new Date().toISOString() };
  return { status: "ACCEPTED", memberType: v.memberType };
}

/**
 * 대한민국 이외 questionnaire (452:4 · 452:47). Figma does not show where each answer set leads,
 * so the answers are only validated and acknowledged (overseas settlement policy TBD).
 */
export async function submitOverseasAnswers(answers: unknown): Promise<OverseasResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!Array.isArray(answers) || answers.length !== OVERSEAS_QUESTIONS.length || !answers.every((a) => typeof a === "boolean")) {
    return { status: "INVALID", message: "모든 질문에 답해 주세요." };
  }
  await mockDelay(300);
  return { status: "RECEIVED" };
}

// ── 정산 자료 등록 (429:219 · 443:5 · 433:210 · 437:4) ─────────────────────────────────

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const digits = (s: string) => s.replace(/\D/g, "");
const isDate6 = (s: string) => {
  if (!/^\d{6}$/.test(s)) return false;
  const m = Number(s.slice(2, 4));
  const d = Number(s.slice(4, 6));
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

/** Rebuilds the logical fields of REQUIRED_FIELDS from the split inputs. */
function readRegistration(fd: FormData) {
  const phone = [str(fd, "phonePrefix"), digits(str(fd, "phoneMid")), digits(str(fd, "phoneLast"))];
  const managerPhone = [str(fd, "managerPhonePrefix"), digits(str(fd, "managerPhoneMid")), digits(str(fd, "managerPhoneLast"))];
  const email = (local: string, domain: string) => (local && domain ? `${local}@${domain}` : "");
  return {
    name: str(fd, "name"),
    idFront: digits(str(fd, "idFront")),
    idBack: digits(str(fd, "idBack")),
    phone: phone.every(Boolean) ? phone.join("-") : "",
    bank: str(fd, "bank"),
    accountNo: digits(str(fd, "accountNo")),
    holder: str(fd, "holder"),
    email: email(str(fd, "emailLocal"), str(fd, "emailDomain")),
    address: [str(fd, "addressBase"), str(fd, "addressDetail")].filter(Boolean).join(" "),
    addressBase: str(fd, "addressBase"),
    channelPlatform: str(fd, "channelPlatform"),
    channelUrl: str(fd, "channelUrl"),
    nationality: str(fd, "nationality"),
    visa: str(fd, "visa"),
    bizNo: [str(fd, "bizNo1"), str(fd, "bizNo2"), str(fd, "bizNo3")].map(digits).join(""),
    taxExempt: str(fd, "taxExempt"),
    corpTaxType: str(fd, "corpTaxType"),
    ceoName: str(fd, "ceoName"),
    companyName: str(fd, "companyName"),
    bizCategory: str(fd, "bizCategory"),
    bizItem: str(fd, "bizItem"),
    managerName: str(fd, "managerName"),
    managerTitle: str(fd, "managerTitle"),
    managerPhone: managerPhone.every(Boolean) ? managerPhone.join("-") : "",
    managerEmail: email(str(fd, "managerEmailLocal"), str(fd, "managerEmailDomain"))
  };
}

type Reg = ReturnType<typeof readRegistration>;

/** Format checks per field. Returns an error message or null. */
function checkField(key: keyof Reg, v: Reg, type: MemberType): string | null {
  const val = v[key];
  switch (key) {
    case "name":
    case "holder":
    case "ceoName":
    case "managerName":
      return val.length >= 2 && val.length <= 40 ? null : "이름은 2~40자로 입력해 주세요.";
    case "companyName":
      return val.length >= 1 && val.length <= 60 ? null : "상호를 입력해 주세요.";
    case "managerTitle":
    case "bizCategory":
    case "bizItem":
      return val.length >= 1 && val.length <= 40 ? null : "필수 항목을 입력해 주세요.";
    case "idFront":
      return isDate6(val) ? null : "생년월일 6자리를 확인해 주세요.";
    case "idBack": {
      // 7 digits; the first digit is 1–4 for citizens and 5–8 for registered foreigners.
      const ok = /^\d{7}$/.test(val) && (type === "FOREIGN_RESIDENT" ? /^[5-8]/.test(val) : /^[1-4]/.test(val));
      return ok ? null : "뒤 7자리를 확인해 주세요.";
    }
    case "phone":
    case "managerPhone":
      return /^01[016789]-\d{3,4}-\d{4}$/.test(val) ? null : "전화번호를 확인해 주세요.";
    case "bank":
      return (BANKS as readonly string[]).includes(val) ? null : "은행을 선택해 주세요.";
    case "accountNo":
      return /^\d{6,20}$/.test(val) ? null : "계좌번호를 숫자로 입력해 주세요.";
    case "email":
    case "managerEmail":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) && val.length <= 100 ? null : "이메일을 확인해 주세요.";
    case "address":
      return v.addressBase.length >= 2 && val.length <= 200 ? null : "주소를 입력해 주세요.";
    case "channelPlatform":
      return CHANNEL_PLATFORMS.some((p) => p.key === val) ? null : "사용채널을 선택해 주세요.";
    case "channelUrl":
      return /^https?:\/\/\S+\.\S+/.test(val) && val.length <= 300 ? null : "http:// 또는 https://로 시작하는 채널 주소를 입력해 주세요.";
    case "nationality":
      return (NATIONALITIES as readonly string[]).includes(val) ? null : "국적을 선택해 주세요.";
    case "visa":
      return (VISA_TYPES as readonly string[]).includes(val) ? null : "체류 자격을 선택해 주세요.";
    case "bizNo":
      return /^\d{10}$/.test(val) ? null : "사업자등록번호 10자리를 확인해 주세요.";
    case "taxExempt":
      return (TAX_EXEMPT_OPTIONS as readonly string[]).includes(val) ? null : "면세 여부를 선택해 주세요.";
    case "corpTaxType":
      return (CORP_TAX_TYPES as readonly string[]).includes(val) ? null : "과세 유형을 선택해 주세요.";
    default:
      return null;
  }
}

const maskAccount = (no: string) => `${"*".repeat(Math.max(0, no.length - 4))}${no.slice(-4)}`;

/**
 * Submits 정산 자료 (multipart). Requires the 이용동의 step for the same member type. Validates every
 * required field and file on the server. The mock keeps only masked values and file names; ID
 * numbers are validated and discarded. TBD: real-name / account verification provider, review
 * workflow and the "인증이 어려운 경우" manual review path, encrypted storage and retention.
 */
export async function registerSettlement(formData: FormData): Promise<RegistrationResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  // Simulated latency comes first: from the state checks below to the write there is no `await`, so
  // two tabs submitting at once cannot both pass ALREADY_REGISTERED and overwrite each other.
  await mockDelay(700);
  const type = formData.get("memberType");
  if (!isMemberType(type)) return { status: "INVALID", message: "회원 유형을 확인해 주세요." };
  if (mockSettlement.terms?.memberType !== type) return { status: "NO_TERMS" };
  if (mockSettlement.registration) return { status: "ALREADY_REGISTERED" };

  const v = readRegistration(formData);
  for (const key of REQUIRED_FIELDS[type] as (keyof Reg)[]) {
    const error = checkField(key, v, type);
    if (error) return { status: "INVALID", message: error, field: key };
  }
  for (const key of REQUIRED_FILES[type]) {
    const file = formData.get(key);
    if (!(file instanceof File) || file.size === 0) return { status: "INVALID", message: "필수 서류를 모두 업로드해 주세요.", field: key };
    if (!(SETTLEMENT_FILE_TYPES as readonly string[]).includes(file.type)) return { status: "INVALID", message: "JPG, PNG, PDF 파일만 업로드할 수 있어요.", field: key };
    if (file.size > SETTLEMENT_FILE_MAX_BYTES) return { status: "INVALID", message: "파일은 5MB 이하만 업로드할 수 있어요.", field: key };
  }

  const registrant = type === "SOLE_PROPRIETOR" ? v.ceoName : type === "CORPORATION" ? v.companyName : v.name;
  mockSettlement.registration = {
    memberType: type,
    registrant,
    holder: v.holder,
    bankName: v.bank,
    accountMasked: maskAccount(v.accountNo),
    code: newSettlementCode(),
    submittedAt: new Date().toISOString()
  };
  mockSettlement.terms = null;
  // TODO: the backend stores the documents, starts verification and writes an audit record.
  return { status: "SUBMITTED" };
}

/** Whether the 이용동의 step was completed for this member type (the form page requires it). */
export async function hasAcceptedSettlementTerms(memberType: unknown): Promise<boolean> {
  assertMock();
  if (!(await getCreatorSession())) return false;
  return isMemberType(memberType) && mockSettlement.terms?.memberType === memberType;
}
