"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { shownMemberName } from "@/services/admin/memberCore";
import { isBlockedBy } from "@/services/moderation/moderationCore";
import { toDateString } from "@/lib/period";
import { getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { accountSince } from "@/services/account/withdrawalCore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { channelCommunityStore } from "./channelCommunityCore";
import { getCreatorById } from "./creators";
import { CHANNEL_POST_MAX, CHANNEL_POSTS_PAGE, type ChannelPostResult, type ChannelPostsView, type ChannelRanking } from "./channelTypes";

/**
 * 채널 홈 보강 Server Actions — code-first. Route `/creators/[id]` (홈 · `?view=community`).
 * The ranking is computed on the server; the viewer's own completed donations this month are real mock
 * data, the other supporters are generated per channel.
 */

const store = channelCommunityStore;

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Channel API is not connected yet.");
};

/** Small deterministic generator so each channel gets stable mock data. */
function seeded(creatorId: string) {
  let h = 2166136261;
  for (const ch of creatorId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h >>> 0) % 10_000) / 10_000;
  };
}

export async function getChannelMonthlyRanking(creatorId: unknown): Promise<ChannelRanking | null> {
  assertMock();
  if (typeof creatorId !== "string" || !(await getCreatorById(creatorId))) return null;
  const session = await getSession();
  const month = toDateString(new Date()).slice(0, 7);

  const rand = seeded(creatorId);
  const field = Array.from({ length: 12 }, (_, i) => ({ name: `팬${String(Math.floor(rand() * 900) + 100)}`, fnAmount: Math.round((400_000 * Math.pow(0.72, i) * (0.8 + rand() * 0.4)) / 100) * 100, me: false }));
  // A donation sent with 프로필 숨기기 went out as 익명: it never counts toward the row under the member's nickname.
  // Only the current account's donations count: after a 재가입 the withdrawn account's are not the viewer's (as in the wallet).
  const since = accountSince();
  const mine = session
    ? mockWallet.donations
        .filter((d) => d.creatorId === creatorId && d.status === "COMPLETED" && !d.hideProfile && d.donatedAt.startsWith(month) && (!since || d.donatedAt >= since))
        .reduce((sum, d) => sum + d.fnAmount, 0)
    : 0;
  const rows = [...field, ...(mine > 0 ? [{ name: session!.nickname, fnAmount: mine, me: true }] : [])]
    .sort((a, b) => b.fnAmount - a.fnAmount || Number(b.me) - Number(a.me))
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r }));
  return { month, rows };
}

const SEED_POSTS = ["오늘 방송도 재밌었어요!", "다음 합방 언제 하나요?", "클립 모음 만들어 봤어요 🙌", "시그니처 새로 나온 거 너무 좋아요", "주말 방송 시간 공지 부탁드려요"];

function seedPosts(creatorId: string) {
  const s = store();
  if (s.seeded[creatorId]) return;
  s.seeded[creatorId] = true;
  const rand = seeded(`${creatorId}-posts`);
  const base = Date.now() - 6 * 86_400_000;
  // Each channel's sample fans are their own members (a 차단 of one must not hide fans on other channels).
  SEED_POSTS.forEach((body, i) =>
    s.posts.push({ id: `cp-seed-${creatorId}-${i}`, creatorId, authorId: `seed-${creatorId}-${i}`, authorName: `팬${String(Math.floor(rand() * 900) + 100)}`, body, createdAt: new Date(base + i * 86_400_000).toISOString(), deleted: false })
  );
}

export async function getChannelPosts(creatorId: unknown, show: unknown = CHANNEL_POSTS_PAGE): Promise<ChannelPostsView | null> {
  assertMock();
  if (typeof creatorId !== "string" || !(await getCreatorById(creatorId))) return null;
  seedPosts(creatorId);
  const session = await getSession();
  const all = store()
    .posts.filter((p) => p.creatorId === creatorId && !p.deleted && !isBlockedBy(session?.userId, p.authorId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = Math.min(Math.max(1, Math.floor(Number(show)) || CHANNEL_POSTS_PAGE), 100);
  return {
    // A withdrawn member's posts stay up under "탈퇴한 회원" (2026-10-08 결정).
    items: all.slice(0, count).map((p) => ({ id: p.id, authorName: shownMemberName(p.authorId, p.authorName), body: p.body, createdAt: p.createdAt, mine: !!session && p.authorId === session.userId })),
    total: all.length,
    hasMore: all.length > count
  };
}

export async function createChannelPost(input: unknown): Promise<ChannelPostResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.creatorId !== "string" || !(await getCreatorById(v.creatorId))) return { status: "NOT_FOUND" };
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  await mockDelay(200);
  // Request ids belong to the member (another member's id never returns their post); nothing awaits from here to the write.
  const requestKey = `${session.userId}:${v.requestId}`;
  const s = store();
  const done = s.requests[requestKey];
  if (done) return { status: "SAVED", id: done };
  const body = typeof v.body === "string" ? v.body.trim() : "";
  if (!body || body.length > CHANNEL_POST_MAX) return { status: "INVALID", message: `내용을 1~${CHANNEL_POST_MAX}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => body.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  seedPosts(v.creatorId);
  const id = `cp-${Date.now().toString(36)}-${s.posts.length}`;
  s.posts.push({ id, creatorId: v.creatorId, authorId: session.userId, authorName: session.nickname, body, createdAt: new Date().toISOString(), deleted: false });
  s.requests[requestKey] = id;
  return { status: "SAVED", id };
}

/** Authors delete their own posts (TBD: channel owner / admin moderation). Idempotent for the author. */
export async function deleteChannelPost(id: unknown): Promise<ChannelPostResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const post = store().posts.find((p) => p.id === id);
  if (!post) return { status: "NOT_FOUND" };
  if (post.authorId !== session.userId) return { status: "FORBIDDEN" };
  post.deleted = true;
  return { status: "DELETED" };
}
