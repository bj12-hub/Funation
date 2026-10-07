"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { isBlockedBy } from "@/services/moderation/moderationCore";
import { getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import {
  BODY_MAX,
  COMMENT_MAX,
  POSTS_PAGE_SIZE,
  TITLE_MAX,
  isBoardCategory,
  type BoardCategory,
  type BoardView,
  type CommentResult,
  type PostDetail,
  type PostSaveResult
} from "./communityTypes";
import { mockCommunity, type MockPost } from "./mockCommunityStore";

/**
 * 커뮤니티 Server Actions — code-first (no Figma frame). Reading is public; writing needs a session,
 * and only the author may edit or delete a post / comment (checked on the server). Writes look the post up
 * after the mock delay and change it in the same tick, so a post deleted or hidden meanwhile is not written to.
 * 글쓰기 and 댓글 carry a request id per form: a retry after a lost response returns the first result instead of
 * writing twice. TBD: moderation, reports, rate limits, images, notices.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Community API is not connected yet.");
};
const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;

const forbidden = (s: string) => MOCK_FORBIDDEN_WORDS.some((w) => s.toLowerCase().includes(w));
const live = (p: MockPost) => !p.deleted;
/** Comments the viewer sees: not deleted, and not by an author the viewer blocked. */
const shownComments = (p: MockPost, viewer: string | undefined) => p.comments.filter((c) => !c.deleted && !isBlockedBy(viewer, c.authorId));
const summary = (p: MockPost, viewer: string | undefined) => ({
  id: p.id,
  category: p.category,
  title: p.title,
  authorName: p.authorName,
  createdAt: p.createdAt,
  commentCount: shownComments(p, viewer).length,
  views: p.views
});

export async function getBoard(params: { category?: unknown; q?: unknown; page?: unknown }): Promise<BoardView> {
  assertMock();
  const category = isBoardCategory(params.category) ? params.category : "ALL";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 40) : "";
  await mockDelay(200);
  const needle = q.toLowerCase();
  // 차단: posts by authors the viewer blocked are left out, and so are their comments in the counts.
  const viewer = (await getSession())?.userId;
  const all = mockCommunity.posts
    .filter((p) => live(p) && !isBlockedBy(viewer, p.authorId) && (category === "ALL" || p.category === category) && (!needle || p.title.toLowerCase().includes(needle) || p.body.toLowerCase().includes(needle)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalPages = Math.max(1, Math.ceil(all.length / POSTS_PAGE_SIZE));
  const n = Number(params.page);
  const page = Number.isInteger(n) && n >= 1 && n <= totalPages ? n : 1;
  return { category, q, items: all.slice((page - 1) * POSTS_PAGE_SIZE, page * POSTS_PAGE_SIZE).map((p) => summary(p, viewer)), page, totalPages, total: all.length };
}

/** Post detail; counts a view (mock: every read). */
export async function getPost(id: unknown): Promise<PostDetail | null> {
  assertMock();
  const session = await getSession();
  const p = typeof id === "string" ? mockCommunity.posts.find((x) => x.id === id && live(x)) : undefined;
  if (!p || isBlockedBy(session?.userId, p.authorId)) return null;
  await mockDelay(150);
  p.views += 1;
  return {
    ...summary(p, session?.userId),
    body: p.body,
    updatedAt: p.updatedAt,
    mine: !!session && session.userId === p.authorId,
    comments: shownComments(p, session?.userId).map((c) => ({ id: c.id, authorName: c.authorName, body: c.body, createdAt: c.createdAt, mine: !!session && session.userId === c.authorId }))
  };
}

function checkPost(v: Record<string, unknown>): { ok: true; category: BoardCategory; title: string; body: string } | { ok: false; message: string } {
  if (!isBoardCategory(v.category)) return { ok: false, message: "분류를 선택해 주세요." };
  const title = typeof v.title === "string" ? v.title.trim() : "";
  const body = typeof v.body === "string" ? v.body.trim() : "";
  if (!title || title.length > TITLE_MAX) return { ok: false, message: `제목을 1~${TITLE_MAX}자로 입력해 주세요.` };
  if (!body || body.length > BODY_MAX) return { ok: false, message: `내용을 1~${BODY_MAX}자로 입력해 주세요.` };
  if (forbidden(title) || forbidden(body)) return { ok: false, message: "사용할 수 없는 단어가 포함되어 있어요." };
  return { ok: true, category: v.category, title, body };
}

export async function createPost(input: unknown): Promise<PostSaveResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  await mockDelay(300);
  // Request ids belong to the member (another member's id never returns their post); nothing awaits from here to the write.
  const requestKey = `${session.userId}:${v.requestId}`;
  const done = mockCommunity.postRequests[requestKey];
  if (done) return { status: "SAVED", id: done };
  const c = checkPost(v);
  if (!c.ok) return { status: "INVALID", message: c.message };
  const id = `p-${Date.now().toString(36)}${mockCommunity.posts.length}`;
  mockCommunity.posts.push({
    id,
    category: c.category,
    title: c.title,
    body: c.body,
    authorId: session.userId,
    authorName: session.nickname,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    views: 0,
    deleted: false,
    comments: []
  });
  mockCommunity.postRequests[requestKey] = id;
  return { status: "SAVED", id };
}

export async function updatePost(id: unknown, input: unknown): Promise<PostSaveResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  await mockDelay(250);
  const p = typeof id === "string" ? mockCommunity.posts.find((x) => x.id === id && live(x)) : undefined;
  if (!p) return { status: "NOT_FOUND" };
  if (p.authorId !== session.userId) return { status: "FORBIDDEN" };
  const c = checkPost((typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>);
  if (!c.ok) return { status: "INVALID", message: c.message };
  Object.assign(p, { category: c.category, title: c.title, body: c.body, updatedAt: new Date().toISOString() });
  return { status: "SAVED", id: p.id };
}

export async function deletePost(id: unknown): Promise<PostSaveResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  await mockDelay(200);
  const p = typeof id === "string" ? mockCommunity.posts.find((x) => x.id === id) : undefined;
  if (!p || p.deleted) return { status: "NOT_FOUND" };
  if (p.authorId !== session.userId) return { status: "FORBIDDEN" };
  p.deleted = true;
  return { status: "SAVED", id: p.id };
}

export async function addComment(postId: unknown, body: unknown, requestId: unknown): Promise<CommentResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  await mockDelay(200);
  // The comment this member's request already added (a retry after a lost response) is not added again.
  const requestKey = `${session.userId}:${requestId}`;
  if (mockCommunity.commentRequests[requestKey]) return { status: "SAVED" };
  const p = typeof postId === "string" ? mockCommunity.posts.find((x) => x.id === postId && live(x)) : undefined;
  if (!p) return { status: "NOT_FOUND" };
  const text = typeof body === "string" ? body.trim() : "";
  if (!text || text.length > COMMENT_MAX) return { status: "INVALID", message: `댓글을 1~${COMMENT_MAX}자로 입력해 주세요.` };
  if (forbidden(text)) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  const id = `cm-${Date.now().toString(36)}${p.comments.length}`;
  p.comments.push({ id, authorId: session.userId, authorName: session.nickname, body: text, createdAt: new Date().toISOString(), deleted: false });
  mockCommunity.commentRequests[requestKey] = id;
  return { status: "SAVED" };
}

export async function deleteComment(postId: unknown, commentId: unknown): Promise<CommentResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  await mockDelay(150);
  const p = typeof postId === "string" ? mockCommunity.posts.find((x) => x.id === postId) : undefined;
  const c = p?.comments.find((x) => x.id === commentId && !x.deleted);
  if (!c) return { status: "NOT_FOUND" };
  if (c.authorId !== session.userId) return { status: "FORBIDDEN" };
  c.deleted = true;
  return { status: "SAVED" };
}
