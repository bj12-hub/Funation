import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminMember, MemberPage } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/**
 * 탈퇴 신청 (회원탈퇴 유예 30일, 2026-11-01 — 플렉스티비 기준): the member's status stays 정상 / 정지 while the request
 * waits; 회원 관리 marks it next to the status and 회원 상세 says when it takes effect.
 */
const member = (withdrawalRequest: AdminMember["withdrawalRequest"]): AdminMember => ({
  id: "u-hongGD123",
  nickname: "홍길동",
  ssumnationId: "hongGD123",
  roles: ["SUPPORTER", "CREATOR"],
  joinedAt: "2025-11-02",
  lastActiveAt: "2026-11-02",
  status: "ACTIVE",
  suspension: null,
  withdrawal: null,
  withdrawalRequest,
  fnBalance: 5_000,
  donationTotalFn: 0,
  creatorId: null
});
// Asked 2026-11-02 00:30 KST (still 11월 1일 in UTC); takes effect 30 days later.
const REQUEST = { requestedAt: "2026-11-01T15:30:00.000Z", effectiveAt: "2026-12-01T15:30:00.000Z" };

const page = (items: AdminMember[]): MemberPage => ({ items, total: items.length, page: 1, totalPages: 1, filter: { q: "", role: "ALL", status: "ALL", page: 1 } });

describe("회원 관리 · 탈퇴 신청", () => {
  it("marks a waiting request next to the status in the list, and nothing for other members", async () => {
    const { MembersScreen } = await import("./members/MemberScreens");
    const html = renderToStaticMarkup(createElement(MembersScreen, { page: page([member(REQUEST), { ...member(null), id: "u-s001", nickname: "별빛시청자" }]) }));
    const rows = html.match(/<tr>.*?<\/tr>/g)!.slice(1);
    expect(rows[0]).toMatch(/정상<\/span> <span class="[^"]*">탈퇴 신청<\/span><\/td>/);
    expect(rows[1]).not.toContain("탈퇴 신청");
  });

  it("says on 회원 상세 when it was asked and when it takes effect, in Korean dates", async () => {
    const { MemberDetailScreen } = await import("./members/MemberScreens");
    const html = renderToStaticMarkup(createElement(MemberDetailScreen, { member: member(REQUEST), audit: [] }));
    expect(html).toContain("탈퇴 신청 · 신청 2026.11.02 · 2026.12.02 탈퇴 적용 예정 — 그 전에 회원이 로그인해서 철회할 수 있어요.");
    // The status and the 이용 제한 actions stay as for any active member.
    expect(html).toMatch(/홍길동 <span class="[^"]*">정상<\/span> <span class="[^"]*">탈퇴 신청<\/span><\/h1>/);
    expect(html).not.toContain("탈퇴한 회원은 이용 제한을 바꿀 수 없어요");
  });

  it("lists every 탈퇴 신청 on 회원 상세 newest first, with how it ended and what the member agreed to", async () => {
    const { MemberDetailScreen } = await import("./members/MemberScreens");
    const withHistory: AdminMember = {
      ...member(REQUEST),
      withdrawalHistory: [
        { ...REQUEST, consentedFn: 5_000, consentedEarningsFn: 30_000, outcome: "PENDING", endedAt: null },
        { requestedAt: "2026-10-20T01:00:00.000Z", effectiveAt: "2026-11-19T01:00:00.000Z", consentedFn: 7_000, consentedEarningsFn: 0, outcome: "CANCELLED", endedAt: "2026-10-25T05:00:00.000Z" }
      ]
    };
    const html = renderToStaticMarkup(createElement(MemberDetailScreen, { member: withHistory, audit: [] }));
    expect(html).toContain("탈퇴 신청 이력");
    const items = html.match(/<li>.*?<\/li>/g)!;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatch(/<strong>대기 중<\/strong> · 신청 .+ · 2026\.12\.02 탈퇴 적용 예정 · 동의한 소멸 FN 5,000 FN · 정산 대기 수익 30,000 FN<\/li>/);
    expect(items[1]).toMatch(/<strong>철회<\/strong> · 신청 .+ · 철회 .+ \(회원 로그인\) · 동의한 소멸 FN 7,000 FN<\/li>/);
    expect(html).toContain("계약 기록으로 5년 보관해요");

    const applied: AdminMember = {
      ...member(null),
      status: "WITHDRAWN",
      withdrawal: { at: "2026-12-02T03:00:00.000Z", forfeitedFn: 5_000, forfeitedEarningsFn: 0, retentionNote: "기본값 (플렉스티비 기준, 법무 검토 전)", retention: [] },
      withdrawalHistory: [{ requestedAt: "2026-11-02T03:00:00.000Z", effectiveAt: "2026-12-02T03:00:00.000Z", consentedFn: 5_000, consentedEarningsFn: 0, outcome: "APPLIED", endedAt: "2026-12-02T03:00:00.000Z" }]
    };
    expect(renderToStaticMarkup(createElement(MemberDetailScreen, { member: applied, audit: [] }))).toMatch(/<strong>탈퇴 적용<\/strong> · 신청 .+ · 탈퇴 적용 .+ · 동의한 소멸 FN 5,000 FN<\/li>/);
  });

  it("shows nothing without a request, also from a site older than the field", async () => {
    const { MemberDetailScreen } = await import("./members/MemberScreens");
    for (const m of [member(null), { ...member(null), withdrawalRequest: undefined, withdrawalHistory: undefined }, { ...member(null), withdrawalHistory: [] }]) {
      const html = renderToStaticMarkup(createElement(MemberDetailScreen, { member: m, audit: [] }));
      expect(html).not.toContain("탈퇴 신청");
    }
  });
});
