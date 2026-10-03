import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

/** Password reset and phone verification contracts: the server re-checks shapes and rules. */
describe("비밀번호 재설정 · 휴대폰 인증", () => {
  it("sends a reset email only to a registered address and re-checks the new password", async () => {
    const m = await import("./passwordReset");
    expect(await m.sendPasswordResetEmail(" USER@funation.kr ")).toEqual({ status: "SENT" });
    expect(await m.sendPasswordResetEmail("nobody@example.com")).toEqual({ status: "EMAIL_NOT_FOUND" });
    expect(await m.sendPasswordResetEmail(42 as unknown as string)).toEqual({ status: "EMAIL_NOT_FOUND" });
    expect(await m.resetPassword("token", "weak")).toEqual({ status: "INVALID" });
    expect(await m.resetPassword("", "Abcd1234!")).toEqual({ status: "INVALID" });
    expect(await m.resetPassword("token", "Abcd1234!")).toEqual({ status: "RESET" });
  });

  it("checks phone shape and purpose, then the code", async () => {
    const m = await import("./verification");
    expect(await m.sendPhoneCode("01012345678", "SIGNUP")).toEqual({ status: "PHONE_NOT_FOUND" });
    expect(await m.sendPhoneCode("010-1234-5678", "LOGIN" as "SIGNUP")).toEqual({ status: "PHONE_NOT_FOUND" });
    expect(await m.sendPhoneCode("010-9999-0000", "SIGNUP")).toEqual({ status: "SENT" });
    expect(await m.sendPhoneCode("010-9999-0000", "PASSWORD_RESET")).toEqual({ status: "PHONE_NOT_FOUND" });
    expect(await m.sendPhoneCode("010-1234-5678", "PASSWORD_RESET")).toEqual({ status: "SENT" });
    expect(await m.verifyPhoneCode("010-1234-5678", "000000")).toEqual({ status: "INVALID_OR_EXPIRED" });
    expect(await m.verifyPhoneCode("bad", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    expect(await m.verifyPhoneCode("010-1234-5678", "123456")).toMatchObject({ status: "VERIFIED" });
  });

  it("logout ends the session and goes home", async () => {
    const endSession = vi.fn();
    const redirect = vi.fn();
    vi.doMock("@/lib/session", () => ({ endSession }));
    vi.doMock("next/navigation", () => ({ redirect }));
    const { logout } = await import("./logout");
    await logout();
    expect(endSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
