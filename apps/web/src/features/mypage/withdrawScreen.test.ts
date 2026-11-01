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
const withdrawButton = (html: string) => html.match(/<button[^>]*>탈퇴 신청하기<\/button>/)?.[0] ?? "";

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

describe("회원 탈퇴 화면 · 탈퇴 신청 (회원탈퇴 유예 30일, 2026-11-01 사용자 결정)", () => {
  it("says the button sends a request that takes effect 30 days later and can be cancelled until then", async () => {
    const html = await render({ ...base, creator: true, unsettledFn: 20_000 });
    const effects = card(html, "withdraw-effects")!;
    const items = [...effects.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
    expect(items[0]).toBe("탈퇴를 신청하면 바로 로그아웃되고, 30일 뒤에 탈퇴가 적용돼요. 그 전에는 로그인해서 언제든 철회할 수 있어요. 신청한 동안에는 계정을 쓸 수 없어요.");
    expect(items).toContain("탈퇴가 적용되면 남은 FN 5,000 FN이 소멸돼요.");
    expect(items.some((i) => i.startsWith("탈퇴가 적용되면 정산 대기 수익 20,000 FN이 소멸되고"))).toBe(true);
    expect(items).toContain("탈퇴가 적용된 계정으로는 다시 로그인할 수 없어요. 새 계정으로는 탈퇴가 적용된 뒤 바로 가입할 수 있지만, 이전 FN과 기록은 돌아오지 않아요.");
    expect(items.some((i) => i.startsWith("신청한 30일 동안 채널은 숨겨지고"))).toBe(true);
    const consent = card(html, "withdraw-consent")!;
    expect(consent).toContain("탈퇴가 적용될 때 남은 FN 5,000 FN이 소멸되는 것에 동의합니다.");
    expect(consent).toContain("탈퇴가 적용될 때 정산 대기 수익 20,000 FN이 소멸되고 심사 대기 중인 정산 신청이 취소되는 것에 동의합니다.");
    expect(consent).toContain("위 내용을 모두 확인했고, 회원 탈퇴를 신청합니다.");
    // Nothing is checked yet: the request button waits for the consents and the password.
    expect(withdrawButton(html)).toContain("disabled");
  });

  it("leaves the creator line out for a supporter", async () => {
    const html = await render(base);
    expect(html).not.toContain("채널은 숨겨지고");
    expect(html).toContain("탈퇴를 신청하면 바로 로그아웃되고, 30일 뒤에 탈퇴가 적용돼요.");
  });
});
