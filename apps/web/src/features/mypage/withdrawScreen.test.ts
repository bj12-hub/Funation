import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WithdrawalInfo } from "@/services/account/withdrawalTypes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/services/account/withdrawal", () => ({ withdrawAccount: vi.fn() }));

/** 회원 탈퇴 (`/mypage/withdraw`) blocker cards — 2026-10-10 결정: 처리 중인 충전 · 지급 중인 출석 보상. */
const base: WithdrawalInfo = {
  nickname: "홍길동",
  fnBalance: 5_000,
  creator: false,
  unsettledFn: 0,
  pendingRefunds: 0,
  pendingQuests: { sent: 0, received: 0 },
  pendingPlatformDonations: 0,
  pendingCharges: 0,
  pendingAttendanceRewards: 0
};

async function render(info: WithdrawalInfo) {
  const { WithdrawScreen } = await import("./WithdrawScreen");
  return renderToStaticMarkup(createElement(WithdrawScreen, { info }));
}

const card = (html: string, id: string) => html.match(new RegExp(`<section[^>]*aria-labelledby="${id}"[^>]*>.*?</section>`))?.[0] ?? null;
const withdrawButton = (html: string) => html.match(/<button[^>]*>탈퇴하기<\/button>/)?.[0] ?? "";

describe("회원 탈퇴 화면 · 처리 중인 충전과 출석 보상", () => {
  it("shows a 처리 중인 충전 card with the count, the note and the link to 충전 내역", async () => {
    const html = await render({ ...base, pendingCharges: 2 });
    const charges = card(html, "withdraw-charges");
    expect(charges).not.toBeNull();
    expect(charges).toContain("처리 중인 충전");
    expect(charges).toContain("2건");
    expect(charges).toContain("결제 확인이 끝나면 충전한 FN이 남은 FN에 더해져요. 충전이 끝난 뒤에 탈퇴할 수 있어요.");
    expect(charges).toContain('href="/wallet/charges"');
    expect(charges).toContain("충전 내역으로");
    expect(withdrawButton(html)).toContain("disabled");
    expect(card(html, "withdraw-rewards")).toBeNull();
  });

  it("shows a 지급 중인 출석 보상 card with the link to 출석체크", async () => {
    const html = await render({ ...base, pendingAttendanceRewards: 1 });
    const rewards = card(html, "withdraw-rewards");
    expect(rewards).toContain("지급 중인 출석 보상");
    expect(rewards).toContain("1건");
    expect(rewards).toContain("출석체크 보상 FN을 지급하고 있어요. 지급이 끝나면 남은 FN에 더해져요. 지급이 끝난 뒤에 탈퇴할 수 있어요.");
    expect(rewards).toContain('href="/attendance"');
    expect(withdrawButton(html)).toContain("disabled");
    expect(card(html, "withdraw-charges")).toBeNull();
  });

  it("shows neither card when nothing is on its way", async () => {
    const html = await render(base);
    expect(card(html, "withdraw-charges")).toBeNull();
    expect(card(html, "withdraw-rewards")).toBeNull();
  });
});
