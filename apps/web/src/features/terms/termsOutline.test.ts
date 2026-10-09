import { describe, expect, it } from "vitest";
import { getMockDonationCatalog } from "@/services/donations/donationCatalog";
import { CHARGE_CONSENTS } from "@/services/wallet/chargeTypes";
import { clauseHeading, isTermsSlug, TERMS_DOCS, TERMS_DRAFT, TERMS_SLUGS, type TermsBlock } from "./termsOutline";

/** Every piece of text a block shows (paragraph, list items, table head and cells). */
const blockTexts = (block: TermsBlock): string[] =>
  typeof block === "string" ? [block] : "ol" in block ? block.ol : "ul" in block ? block.ul : [...block.table.head, ...block.table.rows.flat()];

const docText = (slug: keyof typeof TERMS_DOCS) => TERMS_DOCS[slug].clauses.flatMap((c) => c.body.flatMap(blockTexts)).join("\n");

describe("약관 · 정책 문서 (초안 본문, 2026-10-08)", () => {
  it("has a document for every /terms link (footer · 회원가입 · 채널 만들기 · FN 충전)", () => {
    for (const slug of ["service", "privacy", "youth", "operation", "marketing", "creator", "refund"]) expect(isTermsSlug(slug)).toBe(true);
    for (const bad of ["", "toString", "__proto__", "hasOwnProperty"]) expect(isTermsSlug(bad)).toBe(false);
    expect(TERMS_SLUGS).toHaveLength(7);
    expect(TERMS_DOCS.refund.title).toBe("FN 충전 · 환불 정책");
  });

  it("links each FN 충전 consent that has a document to an existing page, the payment consent to the refund policy", () => {
    const linked = CHARGE_CONSENTS.filter((c) => c.href);
    expect(linked.map((c) => c.key)).toEqual(["privacy", "payment", "marketing"]);
    for (const c of linked) expect(isTermsSlug(c.href!.replace(/^\/terms\//, ""))).toBe(true);
    expect(CHARGE_CONSENTS.find((c) => c.key === "payment")?.href).toBe("/terms/refund");
  });

  it("numbers 약관 by article and policies by section", () => {
    expect(clauseHeading(TERMS_DOCS.service, 0)).toBe("제1조 (목적)");
    expect(clauseHeading(TERMS_DOCS.service, 8)).toBe("제9조 (청약철회와 환불)");
    expect(clauseHeading(TERMS_DOCS.creator, 9)).toBe("제10조 (탈퇴 시 수익 처리)");
    expect(clauseHeading(TERMS_DOCS.privacy, 2)).toBe("3. 개인정보의 보유 및 이용 기간");
    expect(clauseHeading(TERMS_DOCS.refund, 4)).toBe("5. 청약철회");
  });

  it("lists each clause once", () => {
    for (const doc of Object.values(TERMS_DOCS)) {
      expect(doc.clauses.length).toBeGreaterThan(0);
      expect(new Set(doc.clauses.map((c) => c.title)).size).toBe(doc.clauses.length);
    }
  });

  it("has a body for every clause, with no empty paragraph, list or table cell", () => {
    for (const [slug, doc] of Object.entries(TERMS_DOCS)) {
      for (const clause of doc.clauses) {
        expect(clause.body.length, `${slug} · ${clause.title}`).toBeGreaterThan(0);
        for (const block of clause.body) {
          const texts = blockTexts(block);
          expect(texts.length, `${slug} · ${clause.title}`).toBeGreaterThan(0);
          for (const t of texts) expect(t.trim(), `${slug} · ${clause.title}`).not.toBe("");
          if (typeof block === "object" && "table" in block) {
            for (const row of block.table.rows) expect(row, `${slug} · ${clause.title}`).toHaveLength(block.table.head.length);
          }
        }
      }
    }
  });

  it("keeps placeholders out of headings (titles and clause names)", () => {
    for (const doc of Object.values(TERMS_DOCS)) {
      for (const heading of [doc.title, ...doc.clauses.map((c) => c.title)]) expect(heading).not.toMatch(/TBD|미정|자리표시|법무 검토/);
    }
  });

  it("shows the draft banner, 시행일 and version on every document", () => {
    expect(TERMS_DRAFT.banner).toBe("초안 — 일반적인 기준으로 작성했고 법무 검토 전이에요. 정식 오픈 전에 바뀔 수 있어요.");
    expect(TERMS_DRAFT.effectiveDate).toBe("정식 오픈일 (TBD)");
    expect(TERMS_DRAFT.version).toBe("초안 v0.1");
  });

  it("names the operator only as 회사 and keeps 사업자 정보 a placeholder", () => {
    const service = docText("service");
    expect(service).toContain("상호 · 대표자 · 사업자등록번호 · 주소 · 연락처: 정식 오픈 전에 공개 (TBD)");
    // No real-looking business numbers (the footer's Figma sample values must not leak into the terms).
    for (const slug of TERMS_SLUGS) expect(docText(slug)).not.toMatch(/\d{3}-\d{2}-\d{5}|\(주\)/);
  });

  it("states the 2026-10-08 refund defaults in the refund policy and the service terms", () => {
    for (const slug of ["refund", "service"] as const) {
      const text = docText(slug);
      expect(text).toContain("7일 이내");
      expect(text).toContain("환불 수수료 10%");
      expect(text).toContain("3영업일 이내");
      expect(text).toContain("무상 FN을 먼저 쓴 것으로");
      expect(text).toContain("결제 대행사와 연동한 뒤 정합니다 (TBD)");
    }
  });

  it("states the KRW amount of a 수수료 공제 후 환불 in the refund policy (2026-10-08 결정)", () => {
    const remaining = TERMS_DOCS.refund.clauses.find((c) => c.title === "남은 유상 FN의 환불")!.body.flatMap(blockTexts).join("\n");
    expect(remaining).toContain("환불 FN ÷ 충전 FN × 결제 금액");
    expect(remaining).toContain("원 미만은 버립니다");
    expect(remaining).not.toContain("TBD");
  });

  it("states what happens to a suspended member's FN in the service terms and the operation policy (2026-10-08 결정)", () => {
    const limits = (slug: "service" | "operation", title: string) => TERMS_DOCS[slug].clauses.find((c) => c.title === title)!.body.flatMap(blockTexts).join("\n");
    for (const text of [limits("service", "서비스 이용 제한"), limits("operation", "이용 제한 기준")]) {
      expect(text).toContain("정지가 풀리면 다시 쓸 수 있습니다");
      expect(text).toContain("무상 FN은 소멸");
      expect(text).not.toMatch(/남은 FN.{0,30}\(TBD\)/);
    }
  });

  it("lists every case that holds a 탈퇴 in the service terms and the refund policy (2026-10-06 · 10-08 · 10-09 · 10-10 결정)", () => {
    const clause = (slug: "service" | "refund", title: string) => TERMS_DOCS[slug].clauses.find((c) => c.title === title)!.body.flatMap(blockTexts).join("\n");
    // services/account/withdrawal.ts refuses REFUND_PENDING, QUEST_PENDING, PLATFORM_PENDING, CHARGE_PENDING and
    // ATTENDANCE_PENDING.
    for (const text of [clause("service", "회원 탈퇴와 이용계약 해지"), clause("refund", "회원 탈퇴와 남은 FN")]) {
      expect(text).toContain("환불 요청");
      expect(text).toContain("퀘스트 후원");
      expect(text).toContain("처리 결과를 확인 중인 SOOP · FlexTV 플랫폼 후원");
      expect(text).toContain("처리 중인 FN 충전");
      expect(text).toContain("결제 확인을 기다리는 충전 포함");
      expect(text).toContain("지급 중인 출석 보상");
    }
  });

  // These periods must match services/account/retentionPolicy.ts (added on another branch with the same values).
  it("states the retention defaults in the privacy policy", () => {
    const retention = TERMS_DOCS.privacy.clauses[2].body.flatMap(blockTexts).join("\n");
    for (const period of ["5년", "3년", "3개월", "탈퇴 후 1년", "탈퇴 즉시 파기", "탈퇴한 회원"]) expect(retention).toContain(period);
  });

  it("names every donation type of the 후원 screen in the service terms' 후원 definition", () => {
    const definition = TERMS_DOCS.service.clauses[1].body.flatMap(blockTexts).find((t) => t.startsWith("\"후원\""))!;
    // The terms call the 일반 후원 텍스트 (CLAUDE.md §10 "Text"); every other type goes by its tab label.
    const term = (label: string) => (label === "일반" ? "텍스트" : label);
    for (const t of getMockDonationCatalog().types) expect(definition, t.key).toContain(term(t.label));
  });

  it("does not invent undecided money or policy numbers", () => {
    for (const slug of TERMS_SLUGS) {
      const text = docText(slug);
      // FN 가격 · 환율, 수익 배분, 정산 수수료 · 최소 금액: no 원 amounts or percentages other than the 10% refund fee.
      expect(text, slug).not.toMatch(/\d[\d,]*\s*원/);
      expect([...text.matchAll(/(\d+)\s*%/g)].map((m) => m[1]).filter((n) => n !== "10"), slug).toEqual([]);
    }
  });
});
