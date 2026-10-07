import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, phoneToken, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const SIGNUP = {
  email: "new@funation.kr",
  password: "abcd123!",
  nickname: "새회원",
  agreements: { youth: true, service: true, privacy: true, marketing: false }
} as const;

/** Password reset and phone verification contracts: the server re-checks shapes and rules. */
describe("비밀번호 재설정 · 휴대폰 인증", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

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
    expect(await m.sendPhoneCode("01000000000", "SIGNUP")).toEqual({ status: "PHONE_NOT_FOUND" });
    expect(await m.sendPhoneCode("010-1234-5678", "LOGIN" as "SIGNUP")).toEqual({ status: "PHONE_NOT_FOUND" });
    expect(await m.sendPhoneCode("010-0000-0000", "SIGNUP")).toEqual({ status: "SENT" });
    expect(await m.sendPhoneCode("010-0000-0000", "PASSWORD_RESET")).toEqual({ status: "PHONE_NOT_FOUND" });
    expect(await m.sendPhoneCode("010-1234-5678", "PASSWORD_RESET")).toEqual({ status: "SENT" });
    expect(await m.verifyPhoneCode("010-1234-5678", "PASSWORD_RESET", "000000")).toEqual({ status: "INVALID_OR_EXPIRED" });
    expect(await m.verifyPhoneCode("bad", "PASSWORD_RESET", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    expect(await m.verifyPhoneCode("010-1234-5678", "LOGIN" as "SIGNUP", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    const ok = await m.verifyPhoneCode("010-1234-5678", "PASSWORD_RESET", "123456");
    expect(ok).toMatchObject({ status: "VERIFIED" });
    // A random token, not derived from the phone; the code is used up.
    expect(ok.status === "VERIFIED" && ok.verificationToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(await m.verifyPhoneCode("010-1234-5678", "PASSWORD_RESET", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
  });

  it("accepts a code only if it was sent to that phone for that purpose in the last 3 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T10:00:00"));
    const m = await import("./verification");
    // Never sent: the mock code alone is not enough.
    expect(await m.verifyPhoneCode("010-0000-0000", "SIGNUP", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    // Sent for sign-up: not usable for a password reset or for another phone.
    await m.sendPhoneCode("010-0000-0000", "SIGNUP");
    expect(await m.verifyPhoneCode("010-0000-0000", "PASSWORD_RESET", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    expect(await m.verifyPhoneCode("010-0000-0001", "SIGNUP", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    // Expires after 180 s; a new code works again.
    vi.setSystemTime(new Date("2026-10-08T10:03:00"));
    expect(await m.verifyPhoneCode("010-0000-0000", "SIGNUP", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    await m.sendPhoneCode("010-0000-0000", "SIGNUP");
    vi.setSystemTime(new Date("2026-10-08T10:05:59"));
    expect(await m.verifyPhoneCode("010-0000-0000", "SIGNUP", "123456")).toMatchObject({ status: "VERIFIED" });
  });

  it("stops a sent code after 5 wrong tries", async () => {
    const m = await import("./verification");
    await m.sendPhoneCode("010-0000-0000", "SIGNUP");
    for (let i = 0; i < 5; i++) expect(await m.verifyPhoneCode("010-0000-0000", "SIGNUP", "000000")).toEqual({ status: "INVALID_OR_EXPIRED" });
    expect(await m.verifyPhoneCode("010-0000-0000", "SIGNUP", "123456")).toEqual({ status: "INVALID_OR_EXPIRED" });
    // Resending starts a new code.
    await m.sendPhoneCode("010-0000-0000", "SIGNUP");
    expect(await m.verifyPhoneCode("010-0000-0000", "SIGNUP", "123456")).toMatchObject({ status: "VERIFIED" });
  });

  it("lets sign-up use a SIGNUP verification once, and nothing else", async () => {
    const { signup } = await import("./signup");
    const forged = { ...SIGNUP, phoneVerificationToken: "mock-010-0000-0000" };
    expect(await signup(forged)).toEqual({ status: "VERIFICATION_EXPIRED" });
    const reset = { ...SIGNUP, phoneVerificationToken: await phoneToken("PASSWORD_RESET") };
    expect(await signup(reset)).toEqual({ status: "VERIFICATION_EXPIRED" });
    const token = await phoneToken();
    // A refused sign-up does not use the verification up.
    expect(await signup({ ...SIGNUP, email: "hello@funation.kr", phoneVerificationToken: token })).toEqual({ status: "EMAIL_TAKEN" });
    expect(await signup({ ...SIGNUP, phoneVerificationToken: token })).toEqual({ status: "CREATED" });
    expect(await signup({ ...SIGNUP, email: "other@funation.kr", nickname: "다른회원", phoneVerificationToken: token })).toEqual({ status: "VERIFICATION_EXPIRED" });
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
