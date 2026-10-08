/**
 * 탈퇴 회원 정보 보관 기간 — 기본값 (일반적인 기준, 법무 검토 전).
 *
 * The retention of withdrawal records and withdrawn members' data was TBD; on 2026-10-08 the user asked to start from
 * commonly used rules, so every period here is a default awaiting legal review, not a reviewed policy. This one list
 * feeds the 회원 탈퇴 screen, the admin console's 회원 상세 and the privacy policy text; the mock purge
 * (./retentionPurge.ts) applies it. Client-safe: no server imports.
 *
 * Every period counts from the withdrawal (기산점 — also a default: the law counts some records from the transaction,
 * so counting from the withdrawal keeps them at least that long), as Korean calendar months, clamped at a month's end.
 * Data not listed here is destroyed or anonymised at the withdrawal itself (./withdrawal.ts).
 */

/** How every screen and document labels these periods until the legal review. */
export const RETENTION_DEFAULTS_LABEL = "기본값 (일반적인 기준, 법무 검토 전)";

/** 계약 · 청약철회 기록 (전자상거래법). */
export const RETENTION_CONTRACT_YEARS = 5;
/** 대금결제 · 재화 공급 기록 (전자상거래법). */
export const RETENTION_PAYMENT_YEARS = 5;
/** 소비자 불만 · 분쟁 처리 기록 (전자상거래법). */
export const RETENTION_DISPUTE_YEARS = 3;
/** 접속 기록 (통신비밀보호법). */
export const RETENTION_ACCESS_LOG_MONTHS = 3;
/** 부정 이용 방지용 본인 확인 값 (서비스 운영). */
export const RETENTION_PERSON_KEY_YEARS = 1;

export type RetentionCategory = "CONTRACT" | "PAYMENT" | "DISPUTE" | "ACCESS_LOG" | "PERSON_KEY" | "POSTS";

export type RetentionRule = {
  readonly category: RetentionCategory;
  /** 분류. */
  readonly label: string;
  /** How long after the withdrawal, in months; null = not deleted. */
  readonly months: number | null;
  /** 기간, as screens and documents show it. */
  readonly period: string;
  /** 근거 (일반 관행). */
  readonly basis: string;
  /** 포함되는 것. */
  readonly covers: string;
};

/** The list, in the order screens and documents show it (frozen: readers cannot change a period). */
export const RETENTION_RULES: readonly RetentionRule[] = Object.freeze(([
  {
    category: "CONTRACT",
    label: "계약 · 청약철회 기록",
    months: RETENTION_CONTRACT_YEARS * 12,
    period: `${RETENTION_CONTRACT_YEARS}년`,
    basis: "전자상거래법",
    covers: "탈퇴 기록, 약관 동의 기록"
  },
  {
    category: "PAYMENT",
    label: "대금결제 · 재화 공급 기록",
    months: RETENTION_PAYMENT_YEARS * 12,
    period: `${RETENTION_PAYMENT_YEARS}년`,
    basis: "전자상거래법",
    covers: "FN 충전 · 환불 · 후원 · 정산 기록"
  },
  {
    category: "DISPUTE",
    label: "소비자 불만 · 분쟁 처리 기록",
    months: RETENTION_DISPUTE_YEARS * 12,
    period: `${RETENTION_DISPUTE_YEARS}년`,
    basis: "전자상거래법",
    covers: "1:1 문의, 신고 처리 기록"
  },
  {
    category: "ACCESS_LOG",
    label: "접속 기록",
    months: RETENTION_ACCESS_LOG_MONTHS,
    period: `${RETENTION_ACCESS_LOG_MONTHS}개월`,
    basis: "통신비밀보호법",
    covers: "로그인 기록, 로그인 실패 · 잠금 기록"
  },
  {
    category: "PERSON_KEY",
    label: "부정 이용 방지용 본인 확인 값",
    months: RETENTION_PERSON_KEY_YEARS * 12,
    period: `탈퇴 후 ${RETENTION_PERSON_KEY_YEARS}년`,
    basis: "서비스 운영 (부정 이용 방지)",
    covers: "휴대폰 번호 기반 본인 키. 출석 · 이벤트 · 투표 · 룰렛 · 뽑기 1회 제한과 재가입 확인에 쓰임"
  },
  {
    category: "POSTS",
    label: "게시물 (커뮤니티 글 · 댓글 · 채널 글)",
    months: null,
    period: "삭제하지 않음",
    basis: "서비스 운영",
    covers: "작성자는 \"탈퇴한 회원\"으로 표시. 지우고 싶으면 탈퇴 전에 직접 삭제"
  }
] satisfies RetentionRule[]).map((r) => Object.freeze(r)));

export const retentionRule = (category: RetentionCategory): RetentionRule => RETENTION_RULES.find((r) => r.category === category)!;

/** When one category of a withdrawn account's data is due: an ISO time, or null when it is not deleted. */
export type RetentionDue = { category: RetentionCategory; until: string | null };

const KST_OFFSET_MS = 9 * 3_600_000;

/** `months` Korean calendar months after `from`, the day clamped at the target month's end (11-30 + 3 → 02-28). */
function addKoreanMonths(from: Date, months: number): Date {
  const k = new Date(from.getTime() + KST_OFFSET_MS);
  const day = k.getUTCDate();
  k.setUTCDate(1);
  k.setUTCMonth(k.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 0)).getUTCDate();
  k.setUTCDate(Math.min(day, lastDay));
  return new Date(k.getTime() - KST_OFFSET_MS);
}

/**
 * The purge date of every category for an account that withdrew at `withdrawnAt`, in RETENTION_RULES order. Data of a
 * category stays until its date and goes from that moment on (`isRetentionExpired`).
 */
export function retentionSchedule(withdrawnAt: string | Date): RetentionDue[] {
  const from = new Date(withdrawnAt);
  if (Number.isNaN(from.getTime())) throw new RangeError("retentionSchedule: withdrawnAt is not a date");
  return RETENTION_RULES.map((r) => ({ category: r.category, until: r.months === null ? null : addKoreanMonths(from, r.months).toISOString() }));
}

/** The purge date of one category (null = not deleted). */
export const retentionUntil = (withdrawnAt: string | Date, category: RetentionCategory) => retentionSchedule(withdrawnAt).find((d) => d.category === category)!.until;

/** True from the purge date on; never for data that is not deleted. */
export const isRetentionExpired = (until: string | null, now: Date = new Date()) => until !== null && now.getTime() >= Date.parse(until);
