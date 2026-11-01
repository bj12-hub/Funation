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

  it("shows nothing without a request, also from a site older than the field", async () => {
    const { MemberDetailScreen } = await import("./members/MemberScreens");
    for (const m of [member(null), { ...member(null), withdrawalRequest: undefined }]) {
      const html = renderToStaticMarkup(createElement(MemberDetailScreen, { member: m, audit: [] }));
      expect(html).not.toContain("탈퇴 신청");
    }
  });
});
