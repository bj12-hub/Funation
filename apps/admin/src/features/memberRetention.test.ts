import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminMember, MemberRetention } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 탈퇴 회원 정보 보관 (기본값, 법무 검토 전): a withdrawn member's detail shows until when each kind of data is kept. */
const row = (category: MemberRetention["category"], label: string, period: string, until: string | null, purged = false): MemberRetention => ({
  category,
  label,
  period,
  basis: "전자상거래법",
  covers: "탈퇴 기록, 약관 동의 기록",
  until,
  purged
});

const member = (withdrawal: AdminMember["withdrawal"]): AdminMember => ({
  id: "u-hongGD123-w1",
  nickname: "홍길동",
  ssumnationId: "hongGD123",
  roles: ["SUPPORTER"],
  joinedAt: "2025-11-02",
  lastActiveAt: "2026-10-08",
  status: withdrawal ? "WITHDRAWN" : "ACTIVE",
  suspension: null,
  withdrawal,
  fnBalance: 0,
  donationTotalFn: 0,
  creatorId: null
});

describe("회원 상세 — 탈퇴 회원 정보 보관", () => {
  it("lists each category with its Korean date, purged ones as 파기됨 and posts as 삭제하지 않음", async () => {
    const { MemberDetailScreen } = await import("./members/MemberScreens");
    const withdrawal: AdminMember["withdrawal"] = {
      at: "2026-10-08T03:00:00.000Z",
      forfeitedFn: 5_000,
      forfeitedEarningsFn: 0,
      retentionNote: "기본값 (일반적인 기준, 법무 검토 전)",
      retention: [
        row("CONTRACT", "계약 · 청약철회 기록", "5년", "2031-10-08T03:00:00.000Z"),
        // 2027-01-07 16:00 UTC is already 1월 8일 in Korea.
        row("ACCESS_LOG", "접속 기록", "3개월", "2027-01-07T16:00:00.000Z", true),
        row("POSTS", "게시물 (커뮤니티 글 · 댓글 · 채널 글)", "삭제하지 않음", null)
      ]
    };
    const html = renderToStaticMarkup(createElement(MemberDetailScreen, { member: member(withdrawal), audit: [] }));
    expect(html).toContain("탈퇴 회원 정보 보관");
    expect(html).toContain("보관 기간: 기본값 (일반적인 기준, 법무 검토 전).");
    expect(html).toContain("<td>계약 · 청약철회 기록</td><td>2031.10.08까지</td><td>5년</td><td>전자상거래법</td><td>탈퇴 기록, 약관 동의 기록</td>");
    expect(html).toContain("<td>접속 기록</td><td>파기됨 (2027.01.08)</td>");
    expect(html).toContain("<td>게시물 (커뮤니티 글 · 댓글 · 채널 글)</td><td>삭제하지 않음</td>");
  });

  it("shows no retention card for a member who has not withdrawn", async () => {
    const { MemberDetailScreen } = await import("./members/MemberScreens");
    const html = renderToStaticMarkup(createElement(MemberDetailScreen, { member: member(null), audit: [] }));
    expect(html).not.toContain("탈퇴 회원 정보 보관");
  });
});
