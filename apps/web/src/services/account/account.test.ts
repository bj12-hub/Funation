import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 마이페이지 계정: every action re-checks the session and validates on the server. */
async function load() {
  const profile = await import("./profileActions");
  const account = await import("./myAccount");
  const linking = await import("./linkingActions");
  const session = await import("@/lib/session");
  const store = await import("./mockStore");
  return { ...profile, ...account, ...linking, session, store };
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const photo = (bytes: number[], type: string) => {
  const fd = new FormData();
  fd.set("photo", new File([new Uint8Array(bytes)], "me.png", { type }));
  return fd;
};

describe("계정", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("reads the account without credentials and saves simple toggles", async () => {
    const m = await load();
    const me = (await m.getMyAccount())!;
    expect(me.funationId).toBe("hongGD123");
    expect(JSON.stringify(me)).not.toMatch(/password|credentials/);
    expect(await m.updateRankingVisibility("quest", false)).toEqual({ status: "SAVED" });
    expect(await m.updateRankingVisibility("admin" as "quest", false)).toEqual({ status: "FAILED" });
    expect(await m.updateMarketingConsent("yes" as unknown as boolean)).toEqual({ status: "FAILED" });
    expect(await m.updateMarketingConsent(true)).toEqual({ status: "SAVED" });
    expect((await m.getMyAccount())!).toMatchObject({ marketingConsent: true, rankingVisibility: { quest: false } });
    signIn(null);
    expect(await m.getMyAccount()).toBeNull();
    expect(await m.updateMarketingConsent(false)).toEqual({ status: "FAILED" });
  });

  it("changes the nickname and ID with server checks and a 30-day limit", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T10:00:00"));
    const m = await load();
    expect(await m.checkNickname("a")).toEqual({ status: "INVALID" });
    expect(await m.checkNickname("운영자님")).toEqual({ status: "FORBIDDEN" });
    expect(await m.checkNickname("익명")).toEqual({ status: "FORBIDDEN" }); // the hidden-profile label
    expect(await m.checkNickname("FUNATION")).toEqual({ status: "DUPLICATE" });
    expect(await m.changeNickname("새닉네임")).toEqual({ status: "CHANGED", value: "새닉네임" });
    const limited = await m.changeNickname("또바꿈");
    expect(limited).toMatchObject({ status: "LIMITED" });
    expect(limited.status === "LIMITED" && limited.availableFrom.startsWith("2026-11-02")).toBe(true);

    expect(await m.changeFunationId("Upper1")).toEqual({ status: "INVALID" });
    expect(await m.changeFunationId("hongadmin1")).toEqual({ status: "FORBIDDEN" });
    expect(await m.changeFunationId("honggd123")).toEqual({ status: "DUPLICATE" });
    expect(await m.changeFunationId("newid2026")).toEqual({ status: "CHANGED", value: "newid2026" });
    vi.setSystemTime(new Date("2026-11-03T10:00:00"));
    expect(await m.changeNickname("또바꿈")).toEqual({ status: "CHANGED", value: "또바꿈" });
    signIn(null);
    expect(await m.changeNickname("게스트")).toEqual({ status: "UNAUTHORIZED" });
  });

  it("changes the password only with the current one, never reusing a recent one, and signs out", async () => {
    const m = await load();
    const current = m.store.mockCredentials.password;
    expect(await m.changePassword({ current: "wrong", next: "Abcd1234!", confirm: "Abcd1234!" })).toEqual({ status: "WRONG_CURRENT" });
    expect(await m.changePassword({ current, next: "short", confirm: "short" })).toEqual({ status: "INVALID" });
    expect(await m.changePassword({ current, next: "Abcd1234!", confirm: "Abcd1234?" })).toEqual({ status: "MISMATCH" });
    expect(await m.changePassword({ current, next: "Abcd1234!", confirm: "Abcd1234!" })).toEqual({ status: "CHANGED" });
    expect(m.session.revokeSession).toHaveBeenCalled();
    expect(await m.changePassword({ current: "Abcd1234!", next: "Abcd1234!", confirm: "Abcd1234!" })).toEqual({ status: "REUSED" });
  });

  it("accepts a profile photo only when the bytes match its type", async () => {
    const m = await load();
    expect(await m.uploadProfilePhoto(photo([0x3c, 0x73, 0x76, 0x67], "image/png"))).toEqual({ status: "UNSUPPORTED" }); // "<svg" renamed
    expect(await m.uploadProfilePhoto(photo(PNG, "image/gif"))).toEqual({ status: "UNSUPPORTED" });
    const ok = await m.uploadProfilePhoto(photo(PNG, "image/png"));
    expect(ok.status === "UPLOADED" && ok.avatarUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(await m.uploadProfilePhoto(new FormData())).toEqual({ status: "FAILED" });
  });

  it("links login providers and platforms with validated input", async () => {
    const m = await load();
    expect(await m.linkLoginProvider("FACEBOOK")).toEqual({ status: "INVALID" });
    expect(await m.linkLoginProvider("KAKAO")).toEqual({ status: "LINKED" });
    expect((await m.getMyAccount())!.linkedLoginProviders.KAKAO).not.toBeNull();
    expect(await m.unlinkLoginProvider("KAKAO")).toEqual({ status: "UNLINKED" });
    expect(await m.verifyIdentity("SMS")).toEqual({ status: "INVALID" });
    expect(await m.verifyIdentity("PHONE")).toMatchObject({ status: "VERIFIED" });
    expect(await m.verifyIdentity("IPIN")).toMatchObject({ status: "ALREADY_VERIFIED" });
    expect(await m.connectPlatform({ platform: "SOOP", accountId: "x", code: "FN-2026-0920" })).toEqual({ status: "INVALID" });
    expect(await m.connectPlatform({ platform: "SOOP", accountId: "my_soop", code: "1234" })).toEqual({ status: "INVALID_CODE" });
    expect(await m.connectPlatform({ platform: "SOOP", accountId: "my_soop", code: " FN-2026-0920 " })).toEqual({ status: "CONNECTED", handle: "my_soop" });
    expect(await m.disconnectPlatform("SOOP")).toEqual({ status: "DISCONNECTED" });
    signIn(null);
    expect(await m.linkLoginProvider("NAVER")).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.connectPlatform({ platform: "SOOP", accountId: "my_soop", code: "FN-2026-0920" })).toEqual({ status: "UNAUTHORIZED" });
  });
});
