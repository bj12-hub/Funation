import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

/** Sign-up (13:63 · 722:*): the Server Action re-checks formats and required agreements. */
const valid = {
  email: "new@funation.kr",
  password: "abcd123!",
  nickname: "새회원",
  phoneVerificationToken: "mock-010-1234-5678",
  agreements: { youth: true, service: true, privacy: true, marketing: false }
} as const;

describe("signup", () => {
  it("creates a valid account and reports duplicates", async () => {
    const { signup } = await import("./signup");
    expect(await signup(valid)).toEqual({ status: "CREATED" });
    expect(await signup({ ...valid, email: "HELLO@funation.kr" })).toEqual({ status: "EMAIL_TAKEN" });
    expect(await signup({ ...valid, nickname: "funation" })).toEqual({ status: "NICKNAME_TAKEN" });
  });

  it("rejects bad formats and missing required agreements", async () => {
    const { signup } = await import("./signup");
    const bad = [
      { ...valid, email: "not-an-email" },
      { ...valid, password: "short" },
      { ...valid, nickname: "x" },
      { ...valid, phoneVerificationToken: "" },
      { ...valid, agreements: { ...valid.agreements, privacy: false } }
    ];
    for (const b of bad) expect(await signup(b as never)).toEqual({ status: "INVALID" });
  });
});
