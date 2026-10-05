/**
 * 약관·정책 문서의 조항 목차 (2026-10-06 결정: "조항 목차만 자리표시로").
 *
 * Only the clause headings are listed. Every clause body, the 시행일 and the version stay TBD until legal review —
 * do not write clause text here. Headings name what a clause covers, not the rule itself (e.g. "청약철회와 환불"
 * does not say what the refund policy is).
 */

export type TermsSlug = "service" | "privacy" | "youth" | "operation" | "marketing" | "creator";

export type TermsDoc = {
  title: string;
  /** ARTICLE = 제n조 (약관), SECTION = n. (방침·정책·동의서) */
  numbering: "ARTICLE" | "SECTION";
  clauses: string[];
};

/** Order of the document tabs: footer documents first, then the ones linked from 회원가입 · 채널 만들기. */
export const TERMS_DOCS: Record<TermsSlug, TermsDoc> = {
  service: {
    title: "서비스 이용약관",
    numbering: "ARTICLE",
    clauses: [
      "목적",
      "용어의 정의",
      "약관의 게시와 개정",
      "회원가입과 이용계약",
      "회원 정보의 관리",
      "서비스의 제공과 변경",
      "FN 충전과 사용",
      "후원",
      "청약철회와 환불",
      "회원의 의무",
      "서비스 이용 제한",
      "회원 탈퇴와 이용계약 해지",
      "책임의 한계",
      "분쟁 해결과 관할"
    ]
  },
  privacy: {
    title: "개인정보 처리 방침",
    numbering: "SECTION",
    clauses: [
      "처리하는 개인정보 항목",
      "개인정보의 처리 목적",
      "개인정보의 보유 및 이용 기간",
      "개인정보의 제3자 제공",
      "개인정보 처리의 위탁",
      "개인정보의 국외 이전",
      "개인정보의 파기 절차와 방법",
      "정보주체의 권리와 행사 방법",
      "쿠키의 설치·운영과 거부",
      "개인정보의 안전성 확보 조치",
      "개인정보 보호책임자",
      "권익침해 구제 방법",
      "처리 방침의 변경"
    ]
  },
  youth: {
    title: "청소년 보호정책",
    numbering: "SECTION",
    clauses: [
      "목적",
      "유해정보로부터의 청소년 보호 계획",
      "유해정보에 대한 접근 제한과 관리 조치",
      "유해정보로 인한 피해 상담과 고충 처리",
      "청소년 보호 책임자와 담당자"
    ]
  },
  operation: {
    title: "운영정책",
    numbering: "SECTION",
    clauses: [
      "목적",
      "적용 범위",
      "금지 행위",
      "게시물과 채팅 관리",
      "후원 메시지와 후원 콘텐츠 관리",
      "신고와 처리 절차",
      "이용 제한 기준",
      "이의 신청",
      "정책의 변경"
    ]
  },
  marketing: {
    title: "광고성 정보 수신 및 마케팅 활용 동의",
    numbering: "SECTION",
    clauses: ["수집·이용 목적", "수집 항목", "보유 및 이용 기간", "광고성 정보의 전송 방법", "동의 거부 권리와 철회 방법"]
  },
  creator: {
    title: "크리에이터 이용약관",
    numbering: "ARTICLE",
    clauses: [
      "목적",
      "용어의 정의",
      "크리에이터 채널 개설",
      "방송 플랫폼 연동",
      "후원 수익",
      "정산 신청과 지급",
      "세금과 증빙",
      "크리에이터의 의무",
      "이용 제한과 채널 해지",
      "탈퇴 시 수익 처리",
      "책임의 한계",
      "분쟁 해결과 관할"
    ]
  }
};

export const TERMS_SLUGS = Object.keys(TERMS_DOCS) as TermsSlug[];

export const isTermsSlug = (slug: string): slug is TermsSlug => Object.hasOwn(TERMS_DOCS, slug);

/** "제3조 (약관의 게시와 개정)" or "3. 개인정보의 보유 및 이용 기간" */
export function clauseHeading(doc: TermsDoc, index: number) {
  const name = doc.clauses[index];
  return doc.numbering === "ARTICLE" ? `제${index + 1}조 (${name})` : `${index + 1}. ${name}`;
}
