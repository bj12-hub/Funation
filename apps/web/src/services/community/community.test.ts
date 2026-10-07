import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

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
    const res = await createPost({ category: "TIP", title: "위젯 꿀팁", body: "이렇게 하면 됩니다" });
    expect(res.status).toBe("SAVED");
    const id = res.status === "SAVED" ? res.id : "";
    expect((await getBoard({ category: "TIP" })).items.map((p) => p.id)).toContain(id);
    expect((await getBoard({ q: "꿀팁" })).items[0].id).toBe(id);
    const post = (await getPost(id))!;
    expect(post).toMatchObject({ title: "위젯 꿀팁", mine: true, views: 1 });
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
    expect((await createPost({ category: "NOPE", title: "a", body: "b" })).status).toBe("INVALID");
    expect((await createPost({ category: "FREE", title: "", body: "b" })).status).toBe("INVALID");
    expect((await createPost({ category: "FREE", title: "제목", body: "가".repeat(3001) })).status).toBe("INVALID");
    expect((await createPost({ category: "FREE", title: "admin 공지", body: "b" })).status).toBe("INVALID");
    expect(await addComment("p-2", "좋은 질문이네요")).toEqual({ status: "SAVED" });
    const mine = (await getPost("p-2"))!.comments.find((c) => c.mine)!;
    expect(await deleteComment("p-2", mine.id)).toEqual({ status: "SAVED" });
    expect(await deleteComment("p-2", mine.id)).toEqual({ status: "NOT_FOUND" });
    expect((await addComment("p-2", "가".repeat(301))).status).toBe("INVALID");
    signIn(null);
    expect((await createPost({ category: "FREE", title: "제목", body: "내용" })).status).toBe("UNAUTHORIZED");
    expect((await addComment("p-2", "익명")).status).toBe("UNAUTHORIZED");
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
    const res = await createPost({ category: "FREE", title: "지울 글", body: "내용" });
    const id = res.status === "SAVED" ? res.id : "";
    const post = () => mockCommunity.posts.find((p) => p.id === id)!;

    // Deleted in another tab (or hidden by an operator) while the edit and the comment were being saved.
    const [deleted, edit, comment] = await Promise.all([deletePost(id), updatePost(id, { category: "FREE", title: "고친 제목", body: "고친 내용" }), addComment(id, "늦은 댓글")]);
    expect(deleted).toEqual({ status: "SAVED", id });
    expect(edit).toEqual({ status: "NOT_FOUND" });
    expect(comment).toEqual({ status: "NOT_FOUND" });
    expect(post()).toMatchObject({ title: "지울 글", updatedAt: null, comments: [] });
  });
});
