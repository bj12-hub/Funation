import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, phoneToken, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const SIGNUP = {
  email: "new@ssumnation.kr",
  password: "abcd123!",
  nickname: "새회원",
  agreements: { youth: true, service: true, privacy: true, marketing: false }
} as const;

/** Password reset and phone verification contracts: the server re-checks shapes and rules. */
describe("비밀번호 재설정 · 휴대폰 인증", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("sends a reset email only to a registered address", async () => {
    const m = await import("./passwordReset");
    expect(await m.sendPasswordResetEmail(" USER@ssumnation.kr ")).toEqual({ status: "SENT" });
    expect(await m.sendPasswordResetEmail("nobody@example.com")).toEqual({ status: "EMAIL_NOT_FOUND" });
    expect(await m.sendPasswordResetEmail(42 as unknown as string)).toEqual({ status: "EMAIL_NOT_FOUND" });
  });

  it("resets only with a PASSWORD_RESET verification, once, and re-checks the new password", async () => {
    const m = await import("./passwordReset");
    // A made-up or sign-up token is not a verification of the account's phone.
    expect(await m.resetPassword("token", "Abcd1234!")).toEqual({ status: "VERIFICATION_EXPIRED" });
    expect(await m.resetPassword("", "Abcd1234!")).toEqual({ status: "VERIFICATION_EXPIRED" });
    expect(await m.resetPassword(await phoneToken("SIGNUP"), "Abcd1234!")).toEqual({ status: "VERIFICATION_EXPIRED" });
    const token = await phoneToken("PASSWORD_RESET");
    // 8–20 with a letter, a digit and a special character (2026-10-08 결정: one rule everywhere).
    expect(await m.resetPassword(token, "weak")).toEqual({ status: "INVALID" });
    expect(await m.resetPassword(token, "Abcd1234!Abcd1234!abc")).toEqual({ status: "INVALID" });
    expect(await m.resetPassword(token, "Abcd1234!")).toEqual({ status: "RESET" });
    expect(await m.resetPassword(token, "Efgh5678!")).toEqual({ status: "VERIFICATION_EXPIRED" });
  });

  it("writes the new password, lifts the login lock and ends the session", async () => {
    const { login } = await import("./login");
    const { mockCredentials } = await import("@/services/account/mockStore");
    const session = await import("@/lib/session");
    vi.mocked(session.revokeSession).mockClear();
    const m = await import("./passwordReset");
    const signIn = (password: string) => login({ identifier: "hongGD123", password, keepSignedIn: false });
    for (let i = 0; i < 5; i++) await signIn("wrong");
    expect((await signIn("password")).status).toBe("LOCKED");
    const before = mockCredentials.changedAt;
    expect(session.revokeSession).not.toHaveBeenCalled();

    expect(await m.resetPassword(await phoneToken("PASSWORD_RESET"), "Abcd1234!")).toEqual({ status: "RESET" });
    expect(mockCredentials.password).toBe("Abcd1234!");
    expect(mockCredentials.changedAt > before).toBe(true);
    expect(session.revokeSession).toHaveBeenCalled();
    expect((await signIn("password")).status).toBe("WRONG_PASSWORD");
    expect((await signIn("Abcd1234!")).status).toBe("SUCCESS");
  });

  it("refuses one of the last 3 passwords, keeping the verification", async () => {
    const m = await import("./passwordReset");
    expect(await m.resetPassword(await phoneToken("PASSWORD_RESET"), "Abcd1234!")).toEqual({ status: "RESET" });
    // Without a verification the rule says nothing about the old passwords.
    expect(await m.resetPassword("token", "Abcd1234!")).toEqual({ status: "VERIFICATION_EXPIRED" });
    const token = await phoneToken("PASSWORD_RESET");
    expect(await m.resetPassword(token, "Abcd1234!")).toEqual({ status: "REUSED" });
    expect(await m.resetPassword(token, "Efgh5678!")).toEqual({ status: "RESET" });
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

  it("keeps a verified phone usable for 30 minutes (2026-10-08 결정)", async () => {
    const core = await import("./verificationCore");
    const t0 = Date.parse("2026-10-08T10:00:00Z");
    core.recordSentCode("010-0000-0000", "SIGNUP", t0);
    const token = core.verifySentCode("010-0000-0000", "SIGNUP", "123456", t0);
    expect(core.verifiedPhone(token, "SIGNUP", t0 + 30 * 60_000 - 1)).toBe("010-0000-0000");
    expect(core.verifiedPhone(token, "SIGNUP", t0 + 30 * 60_000)).toBeNull();
    expect(core.consumeVerificationToken(token, "SIGNUP", t0 + 30 * 60_000)).toBeNull();
  });

  it("lets sign-up use a SIGNUP verification once, and nothing else", async () => {
    const { signup } = await import("./signup");
    const forged = { ...SIGNUP, phoneVerificationToken: "mock-010-0000-0000" };
    expect(await signup(forged)).toEqual({ status: "VERIFICATION_EXPIRED" });
    const reset = { ...SIGNUP, phoneVerificationToken: await phoneToken("PASSWORD_RESET") };
    expect(await signup(reset)).toEqual({ status: "VERIFICATION_EXPIRED" });
    const token = await phoneToken();
    // A refused sign-up does not use the verification up.
    expect(await signup({ ...SIGNUP, email: "hello@ssumnation.kr", phoneVerificationToken: token })).toEqual({ status: "EMAIL_TAKEN" });
    expect(await signup({ ...SIGNUP, phoneVerificationToken: token })).toEqual({ status: "CREATED" });
    expect(await signup({ ...SIGNUP, email: "other@ssumnation.kr", nickname: "다른회원", phoneVerificationToken: token })).toEqual({ status: "VERIFICATION_EXPIRED" });
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
