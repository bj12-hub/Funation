import { CREATOR_TERMS } from "./drafts/creator";
import { MARKETING_CONSENT } from "./drafts/marketing";
import { OPERATION_POLICY } from "./drafts/operation";
import { PRIVACY_POLICY } from "./drafts/privacy";
import { REFUND_POLICY } from "./drafts/refund";
import { SERVICE_TERMS } from "./drafts/service";
import { YOUTH_POLICY } from "./drafts/youth";

/**
 * 약관·정책 문서 — 초안 본문 (2026-10-08 사용자 지시: "정책 부분은 일반적으로 사용하는 로직으로 시작").
 *
 * Until 2026-10-08 only the clause headings existed (2026-10-06: "조항 목차만 자리표시로"). Every clause now has a
 * draft body in Korean, written from scratch in the general shape of Korean platform terms (제n조 for 약관, numbered
 * sections for 방침 · 정책). They are drafts, not reviewed by legal: each page shows the draft banner, the 시행일 is
 * "정식 오픈일 (TBD)" and the version "초안 v0.1".
 *
 * Rules for the text (see ./drafts/*):
 * - Rules already decided in the code and docs/ are written as they are; refund and retention defaults follow the
 *   2026-10-08 instruction and are marked 기본값.
 * - Company and business details stay placeholders (COMPANY_INFO_TBD); 사업자 정보 is not decided.
 * - Undecided policy (FN 가격 · 환율, 수익 배분, 정산 수수료 · 주기 · 최소 금액, PG, 세금, 연령 기준 …) is written as
 *   TBD in the body, never invented. Headings name what a clause covers and never carry a TBD.
 */

export type TermsSlug = "service" | "privacy" | "youth" | "operation" | "marketing" | "creator" | "refund";

/**
 * One block of a clause body: a paragraph (string), a numbered list (`ol`), a bulleted list (`ul`) or a table.
 * Plain text only — the page renders it as text, never as HTML.
 */
export type TermsBlock = string | { ol: string[] } | { ul: string[] } | { table: { head: string[]; rows: string[][] } };

export type TermsClause = { title: string; body: TermsBlock[] };

export type TermsDoc = {
  title: string;
  /** ARTICLE = 제n조 (약관), SECTION = n. (방침·정책·동의서) */
  numbering: "ARTICLE" | "SECTION";
  clauses: TermsClause[];
};

export { COMPANY_INFO_TBD, effectiveLine, TERMS_DRAFT } from "./drafts/common";

/**
 * Order of the document tabs: footer documents first, then the ones linked from 회원가입 · 채널 만들기, then the
 * FN 충전 · 환불 정책 linked from the FN 충전 약관 (결제 서비스 이용약관 및 환불 정책 동의).
 */
export const TERMS_DOCS: Record<TermsSlug, TermsDoc> = {
  service: SERVICE_TERMS,
  privacy: PRIVACY_POLICY,
  youth: YOUTH_POLICY,
  operation: OPERATION_POLICY,
  marketing: MARKETING_CONSENT,
  creator: CREATOR_TERMS,
  refund: REFUND_POLICY
};

export const TERMS_SLUGS = Object.keys(TERMS_DOCS) as TermsSlug[];

export const isTermsSlug = (slug: string): slug is TermsSlug => Object.hasOwn(TERMS_DOCS, slug);

/** "제3조 (약관의 게시와 개정)" or "3. 개인정보의 보유 및 이용 기간" */
export function clauseHeading(doc: TermsDoc, index: number) {
  const name = doc.clauses[index].title;
  return doc.numbering === "ARTICLE" ? `제${index + 1}조 (${name})` : `${index + 1}. ${name}`;
}
