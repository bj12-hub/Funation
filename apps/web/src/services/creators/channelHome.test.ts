import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 채널 홈 보강: server-computed monthly ranking and the channel's own community feed. */
async function load() {
  const home = await import("./channelHome");
  const { requestDonation } = await import("@/services/donations/donate");
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAccount.fnBalance = 2_000_000;
  return { ...home, requestDonation };
}

describe("channel home", () => {
  beforeEach(() => resetMockStores());

  it("ranks this month's supporters and puts the viewer's completed donations in", async () => {
    const m = await load();
    const before = (await m.getChannelMonthlyRanking("c1"))!;
    expect(before.rows).toHaveLength(10);
    expect(before.rows.some((r) => r.me)).toBe(false);
    expect(before.rows.map((r) => r.fnAmount)).toEqual([...before.rows.map((r) => r.fnAmount)].sort((a, b) => b - a));
    expect(await m.getChannelMonthlyRanking("c1")).toEqual(before);

    await m.requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 1_000_000, message: "", voiceId: null, idempotencyKey: key(1) });
    const after = (await m.getChannelMonthlyRanking("c1"))!;
    expect(after.rows[0]).toMatchObject({ rank: 1, me: true, fnAmount: 1_000_000 });
    expect((await m.getChannelMonthlyRanking("c2"))!.rows.some((r) => r.me)).toBe(false);
    expect(await m.getChannelMonthlyRanking("nope")).toBeNull();
  });

  it("never counts a hidden-profile donation under the member's nickname", async () => {
    const m = await load();
    await m.requestDonation({ creatorId: "c1", hideProfile: true, type: "TEXT", amount: 1_000_000, message: "", voiceId: null, idempotencyKey: key(1) });
    expect((await m.getChannelMonthlyRanking("c1"))!.rows.some((r) => r.me)).toBe(false);
    await m.requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 500_000, message: "", voiceId: null, idempotencyKey: key(2) });
    expect((await m.getChannelMonthlyRanking("c1"))!.rows.find((r) => r.me)).toMatchObject({ name: "홍길동", fnAmount: 500_000 });
  });

  it("does not put the withdrawn account's donations on a 재가입 account's row", async () => {
    const m = await load();
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    const { startNewAccount } = await import("@/services/account/rejoin");
    await m.requestDonation({ creatorId: "c1", hideProfile: false, type: "TEXT", amount: 1_000_000, message: "", voiceId: null, idempotencyKey: key(1) });
    expect((await m.getChannelMonthlyRanking("c1"))!.rows[0]).toMatchObject({ me: true, fnAmount: 1_000_000 });

    // A second later the slot holds a new account (the mock's 재가입 keeps the user id).
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" }, new Date(Date.now() + 1_000));
    expect((await m.getChannelMonthlyRanking("c1"))!.rows.some((r) => r.me)).toBe(false);
  });

  it("never answers another member's request id with their post", async () => {
    const m = await load();
    const mine = await m.createChannelPost({ creatorId: "c1", body: "첫 글", requestId: key(1) });
    signInAs("u-other");
    const theirs = await m.createChannelPost({ creatorId: "c1", body: "다른 회원 글", requestId: key(1) });
    expect(theirs.status).toBe("SAVED");
    expect(theirs).not.toEqual(mine);
    expect((await m.getChannelPosts("c1"))!.items.filter((p) => p.mine).map((p) => p.body)).toEqual(["다른 회원 글"]);
  });

  it("posts once per request id, pages, and lets only the author delete", async () => {
    const m = await load();
    const seeded = (await m.getChannelPosts("c1"))!;
    expect(seeded.items.length).toBeGreaterThan(0);
    const first = await m.createChannelPost({ creatorId: "c1", body: "  응원해요  ", requestId: key(2) });
    expect(await m.createChannelPost({ creatorId: "c1", body: "응원해요", requestId: key(2) })).toEqual(first);
    const view = (await m.getChannelPosts("c1"))!;
    expect(view.total).toBe(seeded.total + 1);
    expect(view.items[0]).toMatchObject({ body: "응원해요", mine: true });
    expect((await m.getChannelPosts("c1", 2))!).toMatchObject({ hasMore: true });
    expect((await m.getChannelPosts("c2"))!.items.some((p) => p.body === "응원해요")).toBe(false);

    expect(await m.deleteChannelPost(seeded.items[0].id)).toEqual({ status: "FORBIDDEN" });
    expect(await m.deleteChannelPost(view.items[0].id)).toEqual({ status: "DELETED" });
    expect((await m.getChannelPosts("c1"))!.total).toBe(seeded.total);

    expect((await m.createChannelPost({ creatorId: "c1", body: " ", requestId: key(3) })).status).toBe("INVALID");
    expect((await m.createChannelPost({ creatorId: "c1", body: "x".repeat(501), requestId: key(4) })).status).toBe("INVALID");
    expect(await m.createChannelPost({ creatorId: "nope", body: "hi", requestId: key(5) })).toEqual({ status: "NOT_FOUND" });
    signIn(null);
    expect(await m.createChannelPost({ creatorId: "c1", body: "hi", requestId: key(6) })).toEqual({ status: "UNAUTHORIZED" });
    expect((await m.getChannelPosts("c1"))!.items.every((p) => !p.mine)).toBe(true);
  });
});
