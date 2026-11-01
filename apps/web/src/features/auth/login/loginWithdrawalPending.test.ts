import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth/login", () => ({ login: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {}, replace() {} }) }));

/**
 * 탈퇴 신청한 계정 (회원탈퇴 유예 30일, 2026-11-01 사용자 결정): the login form's card for WITHDRAWAL_PENDING says when the
 * 탈퇴 takes effect — the Korean day — and offers 탈퇴 철회 or another account.
 */
async function render(effectiveAt: string) {
  const { LoginWithdrawalPending } = await import("./LoginWithdrawalPending");
  const request = { identifier: "hongGD123", password: "password", keepSignedIn: false, next: "/" };
  return renderToStaticMarkup(createElement(LoginWithdrawalPending, { request, effectiveAt, onResult: () => {}, onBack: () => {} }));
}

describe("로그인 · 탈퇴 신청한 계정", () => {
  it("shows the date the 탈퇴 takes effect in Korea time, the cancel button and the way back", async () => {
    // 2026-12-01 15:30 UTC is already 12월 2일 in Korea.
    const html = await render("2026-12-01T15:30:00.000Z");
    expect(html).toContain('<h1 id="auth-card-title"');
    expect(html).toContain("탈퇴 신청한 계정이에요</h1>");
    expect(html).toContain("<p>2026.12.02에 탈퇴가 적용돼요. 그 전에 탈퇴를 철회하면 계정과 FN · 기록을 그대로 다시 쓸 수 있어요.</p>");
    const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map((m) => [m[0].includes("disabled"), m[1]]);
    expect(buttons).toEqual([
      [false, "탈퇴 철회하고 로그인"],
      [false, "다른 계정으로 로그인"]
    ]);
    // DEFAULT: no error line yet.
    expect(html).not.toContain('role="alert"');
  });
});
