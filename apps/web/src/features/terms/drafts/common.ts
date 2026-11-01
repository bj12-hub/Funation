/**
 * Wording shared by the 약관 · 정책 drafts (2026-10-08). Kept apart from ../termsOutline.ts so the draft modules never
 * import it at runtime (it imports them).
 */

/** Shown on every document until legal review (2026-10-08). */
export const TERMS_DRAFT = {
  badge: "초안",
  banner: "초안 — 플렉스티비 약관의 조건을 기준으로 썸네이션에 맞게 고쳤고 법무 검토 전이에요. 정식 오픈 전에 바뀔 수 있어요.",
  effectiveDate: "정식 오픈일 (TBD)",
  version: "초안 v0.1"
} as const;

/** 사업자 정보 is not decided (2026-10-08): the documents name the operator only as "회사". */
export const COMPANY_INFO_TBD = "상호 · 대표자 · 사업자등록번호 · 주소 · 연락처: 정식 오픈 전에 공개 (TBD)";

/**
 * Marks where values come from: FLEXTV's documents (2026-11-01 사용자 결정 — Ssumnation runs on FLEXTV's backend) or
 * Ssumnation's own defaults (common practice, 2026-10-08). None are reviewed by legal yet.
 */
export const DEFAULTS_NOTE = "\"플렉스티비 기준\"으로 표시한 기간 · 절차 · 조건은 플렉스티비 약관과 같은 조건이고, \"기본값\"으로 표시한 기간 · 수수료 · 처리 기한 · 계산 방법은 썸네이션이 일반적인 기준으로 정한 값입니다. 모두 법무 검토 후 바뀔 수 있습니다.";

/** "이 약관은 정식 오픈일 (TBD)부터 시행합니다." — 부칙 and the policies' 변경 sections. */
export const effectiveLine = (subject: "이 약관은" | "이 방침은" | "이 정책은") => `${subject} ${TERMS_DRAFT.effectiveDate}부터 시행합니다.`;
