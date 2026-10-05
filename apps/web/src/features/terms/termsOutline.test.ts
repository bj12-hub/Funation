import { describe, expect, it } from "vitest";
import { CHARGE_CONSENTS } from "@/services/wallet/chargeTypes";
import { clauseHeading, isTermsSlug, TERMS_DOCS, TERMS_SLUGS } from "./termsOutline";

describe("약관 조항 목차", () => {
  it("has a document for every /terms link (footer · 회원가입 · 채널 만들기)", () => {
    for (const slug of ["service", "privacy", "youth", "operation", "marketing", "creator"]) expect(isTermsSlug(slug)).toBe(true);
    for (const bad of ["", "refund", "toString", "__proto__"]) expect(isTermsSlug(bad)).toBe(false);
    expect(TERMS_SLUGS).toHaveLength(6);
  });

  it("links each FN 충전 consent that has a document to an existing page", () => {
    const linked = CHARGE_CONSENTS.filter((c) => c.href);
    expect(linked.map((c) => c.key)).toEqual(["privacy", "payment", "marketing"]);
    for (const c of linked) expect(isTermsSlug(c.href!.replace(/^\/terms\//, ""))).toBe(true);
  });

  it("numbers 약관 by article and policies by section", () => {
    expect(clauseHeading(TERMS_DOCS.service, 0)).toBe("제1조 (목적)");
    expect(clauseHeading(TERMS_DOCS.creator, 9)).toBe("제10조 (탈퇴 시 수익 처리)");
    expect(clauseHeading(TERMS_DOCS.privacy, 2)).toBe("3. 개인정보의 보유 및 이용 기간");
  });

  it("lists each clause once", () => {
    for (const doc of Object.values(TERMS_DOCS)) {
      expect(doc.clauses.length).toBeGreaterThan(0);
      expect(new Set(doc.clauses).size).toBe(doc.clauses.length);
    }
  });
});
