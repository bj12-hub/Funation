import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 커뮤니티 (code-first): public reads, author-only edits, validation. mockEnv's userId is "u-test". */
async function load() {
  return import("./community");
}

describe("커뮤니티", () => {
  beforeEach(() => resetMockStores());

  it("creates, lists, filters and reads a post", async () => {
    const { createPost, getBoard, getPost } = await load();
    const res = await createPost({ category: "TIP", title: "위젯 꿀팁", body: "이렇게 하면 됩니다", requestId: key(1) });
    expect(res.status).toBe("SAVED");
    const id = res.status === "SAVED" ? res.id : "";
    expect((await getBoard({ category: "TIP" })).items.map((p) => p.id)).toContain(id);
    expect((await getBoard({ q: "꿀팁" })).items[0].id).toBe(id);
    const post = (await getPost(id))!;
    // The author's own read is not a view (조회수 below).
    expect(post).toMatchObject({ title: "위젯 꿀팁", mine: true, views: 0 });
  });

  it("marks the comments the post's author wrote, without sending member ids", async () => {
    const { createPost, addComment, getPost } = await load();
    const res = await createPost({ category: "FREE", title: "내 글", body: "본문", requestId: key(1) });
    const id = res.status === "SAVED" ? res.id : "";
    expect(await addComment(id, "글쓴이 댓글", key(2))).toEqual({ status: "SAVED" });
    signInAs("u-other");
    expect(await addComment(id, "다른 회원 댓글", key(3))).toEqual({ status: "SAVED" });
    const comments = (await getPost(id))!.comments;
    // Blocking the post's author from their comment hides the whole post, so the page leaves for the board.
    expect(comments.map((c) => [c.body, c.byPostAuthor])).toEqual([["글쓴이 댓글", true], ["다른 회원 댓글", false]]);
    expect(JSON.stringify(comments)).not.toMatch(/u-test|u-other/);
  });

  it("only the author may edit or delete; others get FORBIDDEN", async () => {
    const { updatePost, deletePost, deleteComment, getPost } = await load();
    expect(await updatePost("p-1", { category: "FREE", title: "변경", body: "변경" })).toEqual({ status: "FORBIDDEN" });
    expect(await deletePost("p-1")).toEqual({ status: "FORBIDDEN" });
    expect(await deleteComment("p-1", "cm-1")).toEqual({ status: "FORBIDDEN" });
    expect((await getPost("p-1"))!.mine).toBe(false);
  });

  it("validates posts and comments and needs a session to write", async () => {
    const { createPost, addComment, getPost, deleteComment } = await load();
    expect((await createPost({ category: "NOPE", title: "a", body: "b", requestId: key(1) })).status).toBe("INVALID");
    expect((await createPost({ category: "FREE", title: "", body: "b", requestId: key(2) })).status).toBe("INVALID");
    expect((await createPost({ category: "FREE", title: "제목", body: "가".repeat(3001), requestId: key(3) })).status).toBe("INVALID");
    expect((await createPost({ category: "FREE", title: "admin 공지", body: "b", requestId: key(4) })).status).toBe("INVALID");
    expect(await addComment("p-2", "좋은 질문이네요", key(5))).toEqual({ status: "SAVED" });
    const mine = (await getPost("p-2"))!.comments.find((c) => c.mine)!;
    expect(await deleteComment("p-2", mine.id)).toEqual({ status: "SAVED" });
    expect(await deleteComment("p-2", mine.id)).toEqual({ status: "NOT_FOUND" });
    expect((await addComment("p-2", "가".repeat(301), key(6))).status).toBe("INVALID");
    signIn(null);
    expect((await createPost({ category: "FREE", title: "제목", body: "내용", requestId: key(7) })).status).toBe("UNAUTHORIZED");
    expect((await addComment("p-2", "익명", key(8))).status).toBe("UNAUTHORIZED");
  });

  it("writes one post and one comment per request id, keeping each member's ids apart", async () => {
    const { createPost, addComment, getPost } = await load();
    const { mockCommunity } = await import("./mockCommunityStore");
    const before = mockCommunity.posts.length;
    const input = { category: "FREE", title: "한 번만", body: "응답을 못 받아 다시 보냈어요", requestId: key(1) };
    const first = await createPost(input);
    expect(first.status).toBe("SAVED");
    // A retry after a lost response, and a double submit that arrives at once.
    expect(await createPost(input)).toEqual(first);
    const both = await Promise.all([createPost({ ...input, requestId: key(2) }), createPost({ ...input, requestId: key(2) })]);
    expect(both[0]).toEqual(both[1]);
    expect(mockCommunity.posts.length).toBe(before + 2);

    expect(await addComment("p-2", "한 번만 달려요", key(3))).toEqual({ status: "SAVED" });
    expect(await addComment("p-2", "한 번만 달려요", key(3))).toEqual({ status: "SAVED" });
    expect((await getPost("p-2"))!.comments.filter((c) => c.body === "한 번만 달려요")).toHaveLength(1);

    // Another member's request with the same id writes their own post and comment.
    signInAs("u-other");
    const theirs = await createPost(input);
    expect(theirs.status).toBe("SAVED");
    expect(theirs).not.toEqual(first);
    expect(await addComment("p-2", "다른 회원 댓글", key(3))).toEqual({ status: "SAVED" });
    expect((await getPost("p-2"))!.comments.some((c) => c.body === "다른 회원 댓글")).toBe(true);

    expect((await createPost({ ...input, requestId: "short" })).status).toBe("INVALID");
    expect((await addComment("p-2", "요청 id 없음", undefined)).status).toBe("INVALID");
  });

  it("tells a search with no results apart from an empty board", async () => {
    const { getBoard } = await load();
    const { boardEmptyText } = await import("./communityTypes");
    const none = await getBoard({ q: "없는 검색어" });
    expect(none.items).toEqual([]);
    expect(boardEmptyText(none.q)).toEqual({ title: "검색 결과가 없어요.", hint: "다른 검색어로 찾아보세요." });
    expect(boardEmptyText("")).toEqual({ title: "아직 게시글이 없어요.", hint: "첫 번째 글을 작성해 보세요!" });
  });

  it("does not edit or comment on a post deleted while the request was in flight", async () => {
    const { createPost, updatePost, deletePost, addComment } = await load();
    const { mockCommunity } = await import("./mockCommunityStore");
    const res = await createPost({ category: "FREE", title: "지울 글", body: "내용", requestId: key(1) });
    const id = res.status === "SAVED" ? res.id : "";
    const post = () => mockCommunity.posts.find((p) => p.id === id)!;

    // Deleted in another tab (or hidden by an operator) while the edit and the comment were being saved.
    const [deleted, edit, comment] = await Promise.all([deletePost(id), updatePost(id, { category: "FREE", title: "고친 제목", body: "고친 내용" }), addComment(id, "늦은 댓글", key(2))]);
    expect(deleted).toEqual({ status: "SAVED", id });
    expect(edit).toEqual({ status: "NOT_FOUND" });
    expect(comment).toEqual({ status: "NOT_FOUND" });
    expect(post()).toMatchObject({ title: "지울 글", updatedAt: null, comments: [] });
  });
});

/**
 * 조회수 — 기본값 (일반적인 기준): one view per member and post a Korean calendar day (KST), never the author's own, and
 * not the page's re-render after a comment. Guests have no anonymous key yet (TBD): each guest page load counts.
 */
describe("커뮤니티 · 조회수", () => {
  // 2026-10-18 23:00 KST; the Korean day turns at 15:00 UTC.
  const at = (iso: string) => vi.setSystemTime(new Date(iso));
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    at("2026-10-18T14:00:00Z");
  });
  afterEach(() => vi.useRealTimers());

  const views = async (id: string) => (await import("./mockCommunityStore")).mockCommunity.posts.find((p) => p.id === id)!.views;

  it("counts a member once per post a Korean day: refreshing and re-opening add nothing, the next day counts again", async () => {
    const { getPost } = await load();
    const start = await views("p-2");
    expect((await getPost("p-2"))!.views).toBe(start + 1);
    await getPost("p-2");
    await getPost("p-2");
    expect(await views("p-2")).toBe(start + 1);
    // Another post is its own view; another member is their own viewer.
    const other = await views("p-1");
    await getPost("p-1");
    expect(await views("p-1")).toBe(other + 1);
    signInAs("u-other");
    await getPost("p-2");
    expect(await views("p-2")).toBe(start + 2);

    // 23:59:59 KST is still the same day; 00:00 KST (not 09:00, the UTC day) is the next one.
    signInAs("u-test");
    at("2026-10-18T14:59:59Z");
    await getPost("p-2");
    expect(await views("p-2")).toBe(start + 2);
    at("2026-10-18T15:00:00Z");
    await getPost("p-2");
    await getPost("p-2");
    expect(await views("p-2")).toBe(start + 3);
  });

  it("never counts the author's own reads", async () => {
    const { createPost, getPost } = await load();
    const res = await createPost({ category: "FREE", title: "내 글", body: "본문", requestId: key(1) });
    const id = res.status === "SAVED" ? res.id : "";
    await getPost(id);
    at("2026-10-19T15:00:00Z");
    await getPost(id);
    expect(await views(id)).toBe(0);
    signInAs("u-other");
    expect((await getPost(id))!.views).toBe(1);
  });

  it("does not count the page's re-render after a comment, not even past midnight", async () => {
    const { addComment, deleteComment, getPost } = await load();
    const start = await views("p-2");
    await getPost("p-2");
    // The member opened the post at 23:00 and comments after midnight; the page then reads the post again.
    at("2026-10-18T15:01:00Z");
    expect(await addComment("p-2", "자정 넘어 단 댓글", key(1))).toEqual({ status: "SAVED" });
    const after = (await getPost("p-2"))!;
    expect(after.views).toBe(start + 1);
    // Deleting it re-renders the page too.
    at("2026-10-19T15:02:00Z");
    expect(await deleteComment("p-2", after.comments.find((c) => c.mine)!.id)).toEqual({ status: "SAVED" });
    await getPost("p-2");
    expect(await views("p-2")).toBe(start + 1);
  });

  it("counts every guest page load (no anonymous visitor key yet, TBD)", async () => {
    const { getPost } = await load();
    const start = await views("p-3");
    signIn(null);
    await getPost("p-3");
    await getPost("p-3");
    expect(await views("p-3")).toBe(start + 2);
  });

  it("keeps only today's records, and a 재가입 does not inherit the withdrawn account's", async () => {
    const { getPost } = await load();
    const { mockCommunity } = await import("./mockCommunityStore");
    const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
    signInAs(SAMPLE_MEMBER_ID); // the slot's member id, as lib/session gives it
    await getPost("p-1");
    await getPost("p-2");
    expect(Object.keys(mockCommunity.viewLog.seen).sort()).toEqual([`${SAMPLE_MEMBER_ID}:p-1`, `${SAMPLE_MEMBER_ID}:p-2`]);

    // The account withdraws and someone signs up in the slot the same day: their first read is a view of its own.
    const start = await views("p-2");
    await rejoinWithPhone("010-1234-5678");
    await getPost("p-2");
    expect(await views("p-2")).toBe(start + 1);

    // The next day starts a new log.
    at("2026-10-19T15:00:00Z");
    await getPost("p-3");
    expect(mockCommunity.viewLog).toEqual({ day: "2026-10-20", seen: { [`${SAMPLE_MEMBER_ID}:p-3`]: true } });
  });
});
