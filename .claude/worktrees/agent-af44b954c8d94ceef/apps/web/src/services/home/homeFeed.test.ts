import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 홈 피드: the 인기 크리에이터 strip only shows channels the public screens still open. */
describe("home feed", () => {
  beforeEach(() => resetMockStores());

  it("leaves a suspended creator out of the 인기 크리에이터 strip until the suspension is lifted", async () => {
    const { getHomeFeed } = await import("./homeFeed");
    const { suspendMember, restoreMember } = await import("@/services/admin/members");
    const { creatorMemberId } = await import("@/services/admin/memberCore");
    expect((await getHomeFeed()).creators.map((c) => c.id)).toContain("c4");

    expect(await suspendMember(OP, { id: creatorMemberId("c4"), days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(1) })).toEqual({ status: "OK" });
    const feed = await getHomeFeed();
    expect(feed.creators.map((c) => c.id)).not.toContain("c4");
    expect(feed.creators.length).toBeGreaterThan(0);
    // The others keep their profile popup data.
    expect(feed.creators.every((c) => c.profile.status !== "" && c.profile.tags.length > 0)).toBe(true);

    expect(await restoreMember(OP, { id: creatorMemberId("c4"), reason: "소명 확인 후 해제" })).toEqual({ status: "OK" });
    expect((await getHomeFeed()).creators.map((c) => c.id)).toContain("c4");
  });
});
