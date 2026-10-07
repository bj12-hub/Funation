import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, phoneToken, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Sign-up (13:63 · 722:*): the Server Action re-checks formats and required agreements. */
const valid = {
  email: "new@funation.kr",
  password: "abcd123!",
  nickname: "새회원",
  agreements: { youth: true, service: true, privacy: true, marketing: false }
} as const;

describe("signup", () => {
  beforeEach(() => resetMockStores());

  it("creates a valid account and reports duplicates", async () => {
    const { signup } = await import("./signup");
    const phoneVerificationToken = await phoneToken();
    expect(await signup({ ...valid, phoneVerificationToken })).toEqual({ status: "CREATED" });
    expect(await signup({ ...valid, phoneVerificationToken, email: "HELLO@funation.kr" })).toEqual({ status: "EMAIL_TAKEN" });
    expect(await signup({ ...valid, phoneVerificationToken, email: "another@funation.kr", nickname: "funation" })).toEqual({ status: "NICKNAME_TAKEN" });
  });

  it("applies the member nickname rules: forbidden words, 익명, other members' nicknames and channel names", async () => {
    const { signup, checkNicknameAvailability } = await import("./signup");
    const phoneVerificationToken = await phoneToken();
    const ok = { ...valid, phoneVerificationToken };
    expect(await checkNicknameAvailability("익명")).toEqual({ available: false, reason: "FORBIDDEN" });
    expect(await checkNicknameAvailability("운영자님")).toEqual({ available: false, reason: "FORBIDDEN" });
    expect(await checkNicknameAvailability(" 별빛시청자 ")).toEqual({ available: false, reason: "DUPLICATE" }); // a member
    expect(await checkNicknameAvailability("하루봄")).toEqual({ available: false, reason: "DUPLICATE" }); // a channel
    expect(await checkNicknameAvailability("홍길동")).toEqual({ available: false, reason: "DUPLICATE" }); // the active account
    expect(await checkNicknameAvailability("새회원")).toEqual({ available: true });
    expect(await signup({ ...ok, nickname: "익명" })).toEqual({ status: "INVALID" });
    expect(await signup({ ...ok, nickname: "admin1" })).toEqual({ status: "INVALID" });
    expect(await signup({ ...ok, nickname: "별빛시청자" })).toEqual({ status: "NICKNAME_TAKEN" });
    expect(await signup({ ...ok, nickname: "하루봄" })).toEqual({ status: "NICKNAME_TAKEN" });
    expect(await signup({ ...ok, nickname: "홍길동" })).toEqual({ status: "NICKNAME_TAKEN" });
    expect(await signup(ok)).toEqual({ status: "CREATED" });
  });

  it("records a sign-up the one-slot mock cannot hold, so its e-mail and nickname are taken afterwards", async () => {
    const { signup, checkEmailAvailability } = await import("./signup");
    const { mockAccount } = await import("@/services/account/mockStore");
    // The sample account's own e-mail is registered.
    expect(await checkEmailAvailability("User@funation.kr")).toEqual({ available: false });
    expect(await signup({ ...valid, email: "user@funation.kr", phoneVerificationToken: await phoneToken() })).toEqual({ status: "EMAIL_TAKEN" });
    expect(await signup({ ...valid, phoneVerificationToken: await phoneToken() })).toEqual({ status: "CREATED" });
    expect(mockAccount.nickname).toBe("홍길동"); // the active account is untouched
    expect(await checkEmailAvailability(" NEW@funation.kr ")).toEqual({ available: false });
    expect(await signup({ ...valid, nickname: "다른이름", phoneVerificationToken: await phoneToken() })).toEqual({ status: "EMAIL_TAKEN" });
    expect(await signup({ ...valid, email: "other@funation.kr", phoneVerificationToken: await phoneToken() })).toEqual({ status: "NICKNAME_TAKEN" });
  });

  it("rejects bad formats and missing required agreements", async () => {
    const { signup } = await import("./signup");
    const phoneVerificationToken = await phoneToken();
    const ok = { ...valid, phoneVerificationToken };
    const bad = [
      { ...ok, email: "not-an-email" },
      { ...ok, password: "short" },
      { ...ok, password: "Abcd1234!Abcd1234!abc" }, // 21 chars: 8–20 everywhere (2026-10-08 결정)
      { ...ok, nickname: "x" },
      { ...ok, phoneVerificationToken: "" },
      { ...ok, agreements: { ...valid.agreements, privacy: false } }
    ];
    for (const b of bad) expect(await signup(b as never)).toEqual({ status: "INVALID" });
  });
});
