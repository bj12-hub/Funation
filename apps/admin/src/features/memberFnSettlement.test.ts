import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTION_LABEL, type AdminMember, type FnSettlementLine, type MemberFnSettlement } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 남은 FN 정리 (2026-10-08 결정): a 영구 정지 member's detail shows the site's 정리 and one action. */
const member = (until: string | null): AdminMember => ({
  id: "u-hongGD123",
  nickname: "홍길동",
  ssumnationId: "hongGD123",
  roles: ["SUPPORTER"],
  joinedAt: "2025-11-02",
  lastActiveAt: "2026-10-08",
  status: "SUSPENDED",
  suspension: { reason: "결제 도용 확인", at: "2026-10-08T03:00:00.000Z", until, by: "운영자" },
  withdrawal: null,
  fnBalance: 12_800,
  donationTotalFn: 3_000,
  creatorId: null
});

const A: FnSettlementLine = { chargeId: "ch-a", chargedAt: "2026-10-01 15:00:00", methodLabel: "카카오페이", chargeFn: 10_000, paidKrw: 11_000, type: "PARTIAL", grossFn: 7_500, feeFn: 750, netFn: 6_750, refundKrw: 7_425 };
const B: FnSettlementLine = { chargeId: "ch-b", chargedAt: "2026-10-05 15:00:00", methodLabel: "카카오페이", chargeFn: 5_000, paidKrw: 5_500, type: "FULL_CANCEL", grossFn: 5_000, feeFn: 0, netFn: 5_000, refundKrw: 5_500 };
const plan = (patch: Partial<MemberFnSettlement> = {}): MemberFnSettlement => ({
  status: "READY",
  blocked: null,
  balanceFn: 12_800,
  lines: [A, B],
  total: { grossFn: 12_500, feeFn: 750, netFn: 11_750, refundKrw: 12_925 },
  forfeitFn: 300,
  history: [],
  ...patch
});

async function detail(until: string | null, fnSettlement: MemberFnSettlement | null) {
  const { MemberDetailScreen } = await import("./members/MemberScreens");
  return renderToStaticMarkup(createElement(MemberDetailScreen, { member: member(until), audit: [], fnSettlement }));
}

describe("회원 상세 — 남은 FN 정리", () => {
  it("lists the refundable paid FN per charge with type, fee, net and KRW, the forfeited free FN and one action", async () => {
    const html = await detail(null, plan());
    expect(html).toContain("영구 정지 · 사유: 결제 도용 확인 · 처리: 운영자");
    expect(html).toContain("남은 FN 정리</h2>");
    expect(html).toContain("보유 FN: 12,800 FN");
    expect(html).toContain("<td>2026-10-01 15:00 · 카카오페이</td><td>10,000 FN · 11,000원</td><td>수수료 공제 후 환불</td><td>7,500 FN</td><td>750 FN</td><td>6,750 FN</td><td>7,425원</td>");
    expect(html).toContain("<td>2026-10-05 15:00 · 카카오페이</td><td>5,000 FN · 5,500원</td><td>전액 취소</td><td>5,000 FN</td><td>0 FN</td><td>5,000 FN</td><td>5,500원</td>");
    expect(html).toContain("합계</th><td>12,500 FN</td><td>750 FN</td><td>11,750 FN</td><td>12,925원</td>");
    expect(html).toContain("소멸되는 무상 FN: 300 FN");
    expect(html).toContain("결제 수단별 환불 방식은 결제 대행사 연동 후 확정");
    expect(html).toMatch(/<textarea[^>]*aria-label="남은 FN 정리 메모"/);
    // No memo yet: DISABLED until one is typed.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>환불 처리 및 FN 정리<\/button>/);
  });

  it("shows why it waits (보류 · 심사 대기) with the form disabled, and EMPTY / NO_LEDGER without a form", async () => {
    const reason = "보류 중인 환불 요청이 있어 남은 FN을 정리할 수 없어요. 결제 · 환불에서 보류를 해제하고 그 요청을 먼저 처리해 주세요.";
    const blocked = await detail(null, plan({ status: "BLOCKED", blocked: reason }));
    expect(blocked).toContain(reason);
    expect(blocked).toMatch(/<textarea[^>]*disabled=""/);

    const settled = { at: "2026-10-08T04:00:00.000Z", by: "운영자", note: "회원 요청 (1:1 문의)", lines: [A, B], forfeitFn: 300 };
    const empty = await detail(null, plan({ status: "EMPTY", balanceFn: 0, lines: [], total: { grossFn: 0, feeFn: 0, netFn: 0, refundKrw: 0 }, forfeitFn: 0, history: [settled] }));
    expect(empty).toContain("정리할 FN이 없어요.");
    expect(empty).not.toContain("환불 처리 및 FN 정리");
    expect(empty).toContain("정리 이력");
    expect(empty).toContain("환불 2건 · 12,500 FN 회수 · 11,750 FN 환불 · 12,925원 · 무상 FN 소멸 300 FN</strong> · 회원 요청 (1:1 문의) · 운영자");

    const noLedger = await detail(null, plan({ status: "NO_LEDGER", lines: [] }));
    expect(noLedger).toContain("이 회원의 지갑 기록이 없어 남은 FN을 계산할 수 없어요.");
    expect(noLedger).not.toContain("환불 처리 및 FN 정리");
  });

  it("shows no 정리 for a suspension with an end, and says the FN stay for after it", async () => {
    const html = await detail("2026-10-15T03:00:00.000Z", null);
    expect(html).not.toContain("남은 FN 정리</h2>");
    expect(html).toContain("2026.10.15까지 정지");
    expect(html).toContain("정지 중에도 보유 FN은 그대로 남아요. 정지 중에는 쓸 수 없고, 정지가 풀리면 다시 쓸 수 있어요.");
  });

  it("names the 정리 in the audit log and offers 영구 as the open-ended suspension", async () => {
    expect(AUDIT_ACTION_LABEL.MEMBER_FN_SETTLE).toBe("남은 FN 정리");
    const { MemberActions } = await import("./members/MemberActions");
    const html = renderToStaticMarkup(createElement(MemberActions, { id: "u-s001", suspended: false }));
    expect(html).toContain(">영구</button>");
    expect(html).not.toContain("무기한");
  });
});
