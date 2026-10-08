import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 업데이트 소식 (code-first): newest first, unread until the page marks them read. */
describe("업데이트 소식", () => {
  beforeEach(() => resetMockStores());

  it("lists posts newest first with unread marks, and marks them read idempotently", async () => {
    const { getUpdates, getLatestUpdates, markUpdatesRead } = await import("./updates");
    const all = (await getUpdates())!;
    expect(all.posts.length).toBeGreaterThan(0);
    expect(all.unreadCount).toBe(all.posts.length);
    expect(all.posts.map((p) => p.date)).toEqual([...all.posts.map((p) => p.date)].sort().reverse());
    expect((await getLatestUpdates(2))!.posts).toHaveLength(2);

    expect(await markUpdatesRead()).toEqual({ status: "SAVED" });
    expect(await markUpdatesRead()).toEqual({ status: "SAVED" });
    const after = (await getUpdates())!;
    expect(after.unreadCount).toBe(0);
    expect(after.posts.every((p) => !p.unread)).toBe(true);
  });

  it("is creator-only", async () => {
    const { getUpdates, markUpdatesRead } = await import("./updates");
    signIn(["SUPPORTER"]);
    expect(await getUpdates()).toBeNull();
    expect(await markUpdatesRead()).toEqual({ status: "UNAUTHORIZED" });
  });
});
