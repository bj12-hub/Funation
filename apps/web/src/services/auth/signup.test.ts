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
    expect(await signup({ ...valid, phoneVerificationToken, nickname: "funation" })).toEqual({ status: "NICKNAME_TAKEN" });
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
