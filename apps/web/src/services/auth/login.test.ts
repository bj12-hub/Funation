import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/** 로그인 제한 (718:213): wrong passwords are counted per account, however the identifier is typed. */
const PASSWORD = "password"; // the mock account's initial password (services/account/mockStore.ts)
const attempt = async (identifier: string, password: string) => {
  const { login } = await import("./login");
  return (await login({ identifier, password, keepSignedIn: false })).status;
};

describe("로그인 실패 횟수", () => {
  beforeEach(() => resetMockStores());

  it("locks the account after 5 failures even when the identifier is typed differently each time", async () => {
    const spellings = ["hongGD123", " hongGD123", "HONGGD123", "honggd123 ", " HongGd123 "];
    for (const id of spellings.slice(0, 4)) expect(await attempt(id, "wrong")).toBe("WRONG_PASSWORD");
    expect(await attempt(spellings[4], "wrong")).toBe("LOCKED");
    // Locked for every spelling, also with the right password, until a reset.
    expect(await attempt("hongGD123", PASSWORD)).toBe("LOCKED");
    expect(await attempt("user@ssumnation.kr", PASSWORD)).toBe("LOCKED");
  });

  it("starts the count again after a successful login", async () => {
    for (let i = 0; i < 4; i++) expect(await attempt("hongGD123", "wrong")).toBe("WRONG_PASSWORD");
    expect(await attempt(" HONGGD123 ", PASSWORD)).toBe("SUCCESS");
    for (let i = 0; i < 4; i++) expect(await attempt("hongGD123", "wrong")).toBe("WRONG_PASSWORD");
  });

  it("keeps the lock however long it has been: only a password reset lifts it (2026-10-08 결정)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-08T10:00:00"));
      for (let i = 0; i < 4; i++) expect(await attempt("hongGD123", "wrong")).toBe("WRONG_PASSWORD");
      expect(await attempt("hongGD123", "wrong")).toBe("LOCKED");
      vi.setSystemTime(new Date("2027-10-08T10:00:00"));
      expect(await attempt("hongGD123", PASSWORD)).toBe("LOCKED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not count identifiers that belong to no account", async () => {
    for (let i = 0; i < 6; i++) expect(await attempt(" UNKNOWN ", "wrong")).toBe("UNKNOWN_ID");
    expect(await attempt("hongGD123", 42 as unknown as string)).toBe("WRONG_PASSWORD");
    expect(await attempt(null as unknown as string, PASSWORD)).toBe("UNKNOWN_ID");
    expect(await attempt("hongGD123", PASSWORD)).toBe("SUCCESS");
  });
});
