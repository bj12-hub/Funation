import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 2026-10-08 결정: a withdrawn member's 커뮤니티 posts, comments and channel posts stay up with the author shown as
 * "탈퇴한 회원" (while the account is withdrawn and after a 재가입 moved them to `…-wN`); block lists say the same.
 */
async function load() {
  const community = await import("./community");
  const channel = await import("@/services/creators/channelHome");
  const moderation = await import("@/services/moderation/moderation");
  const { withdrawalStore } = await import("@/services/account/withdrawalCore");
  const { startNewAccount } = await import("@/services/account/rejoin");
  const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
  return { ...community, ...channel, ...moderation, withdrawalStore, startNewAccount, SAMPLE_MEMBER_ID };
}

const WITHDRAWN = "탈퇴한 회원";

describe("withdrawn authors", () => {
  beforeEach(() => resetMockStores());

  it("shows a withdrawn member's posts, comments, channel posts and block entries as 탈퇴한 회원", async () => {
    const m = await load();
    signInAs(m.SAMPLE_MEMBER_ID); // the slot's member id, as lib/session gives it
    const post = await m.createPost({ category: "FREE", title: "탈퇴할 회원의 글", body: "내용", requestId: key(1) });
    const postId = post.status === "SAVED" ? post.id : "";
    expect(await m.addComment("p-2", "탈퇴할 회원의 댓글", key(2))).toEqual({ status: "SAVED" });
    const channelPost = await m.createChannelPost({ creatorId: "c1", body: "탈퇴할 회원의 응원", requestId: key(3) });
    const channelPostId = channelPost.status === "SAVED" ? channelPost.id : "";
    signInAs("u-blocker");
    expect(await m.blockAuthorOf({ target: { type: "POST", id: postId } })).toEqual({ status: "OK", name: "홍길동" });

    const names = async () => ({
      board: (await m.getBoard({})).items.find((p) => p.id === postId)?.authorName,
      post: (await m.getPost(postId))?.authorName,
      comment: (await m.getPost("p-2"))!.comments.find((c) => c.body === "탈퇴할 회원의 댓글")?.authorName,
      channel: (await m.getChannelPosts("c1"))!.items.find((p) => p.id === channelPostId)?.authorName
    });

    // The account withdraws (withdrawAccount records this; the session mock does not look at it).
    m.withdrawalStore().withdrawal = { at: new Date().toISOString(), requestId: key(90), forfeitedFn: 0, forfeitedEarningsFn: 0, nickname: "홍길동", funationId: "hongGD123" };
    signInAs("u-other");
    expect(await names()).toEqual({ board: WITHDRAWN, post: WITHDRAWN, comment: WITHDRAWN, channel: WITHDRAWN });
    expect(await m.getPost(postId)).toMatchObject({ mine: false });
    // Reporting and blocking still work, under the same name.
    expect(await m.submitReport({ target: { type: "POST", id: postId }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
    expect(await m.blockAuthorOf({ target: { type: "CHANNEL_POST", id: channelPostId } })).toEqual({ status: "OK", name: WITHDRAWN });
    signInAs("u-blocker");
    expect((await m.listBlocks())!.map((b) => b.name)).toEqual([WITHDRAWN]);

    // After a 재가입 the content belongs to `…-w1` and still shows 탈퇴한 회원; the new account's own posts show its nickname.
    expect(m.startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-0000-0000" })).toBe(true);
    signInAs("u-reader"); // u-other blocked them above
    expect(await names()).toEqual({ board: WITHDRAWN, post: WITHDRAWN, comment: WITHDRAWN, channel: WITHDRAWN });
    signInAs(m.SAMPLE_MEMBER_ID);
    const fresh = await m.createPost({ category: "FREE", title: "새 계정 글", body: "내용", requestId: key(4) });
    expect((await m.getBoard({})).items.find((p) => p.id === (fresh.status === "SAVED" ? fresh.id : ""))?.authorName).toBe("홍길동");
    expect(await m.getPost(postId)).toMatchObject({ authorName: WITHDRAWN, mine: false });
    expect(await m.updatePost(postId, { category: "FREE", title: "고침", body: "고침" })).toEqual({ status: "FORBIDDEN" });
    expect(await m.deletePost(postId)).toEqual({ status: "FORBIDDEN" });
    expect(await m.deleteChannelPost(channelPostId)).toEqual({ status: "FORBIDDEN" });
    signInAs("u-blocker");
    const [entry] = (await m.listBlocks())!;
    expect(entry.name).toBe(WITHDRAWN);
    expect(await m.unblock(entry.id)).toEqual({ status: "OK", name: WITHDRAWN });
  });
});
