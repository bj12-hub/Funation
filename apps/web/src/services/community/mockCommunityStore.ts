import type { BoardCategory } from "./communityTypes";

/**
 * Development-only board data. `authorId` is the member id; the mock member is "u-hongGD123"
 * (lib/session). Seed posts come from other sample members. Server-side only, kept on `globalThis`.
 */

export type MockComment = { id: string; authorId: string; authorName: string; body: string; createdAt: string; deleted: boolean };
export type MockPost = {
  id: string;
  category: BoardCategory;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
  views: number;
  deleted: boolean;
  comments: MockComment[];
};

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const seed: MockPost[] = [
  {
    id: "p-1",
    category: "TIP",
    title: "OBS에 후원 알림 위젯 붙이는 법 정리",
    body: "크리에이터 스튜디오 > 후원위젯/알림설정에서 위젯 주소를 복사해서 OBS 브라우저 소스에 넣으면 돼요.\n크기는 1920x1080 기준으로 맞추면 편해요.",
    authorId: "u-sample-1",
    authorName: "방송초보",
    createdAt: ago(30),
    updatedAt: null,
    views: 128,
    deleted: false,
    comments: [{ id: "cm-1", authorId: "u-sample-2", authorName: "새벽라디오", body: "덕분에 바로 성공했어요!", createdAt: ago(28), deleted: false }]
  },
  { id: "p-2", category: "QNA", title: "룰렛 후원은 어떻게 당첨이 정해지나요?", body: "당첨 방식이 궁금합니다.", authorId: "u-sample-2", authorName: "새벽라디오", createdAt: ago(10), updatedAt: null, views: 42, deleted: false, comments: [] },
  { id: "p-3", category: "FREE", title: "오늘 불꽃크루 엑셀방송 레전드였네요", body: "막판 순위 역전 3번 연속 터짐 ㅋㅋ", authorId: "u-sample-3", authorName: "콩트러버", createdAt: ago(2), updatedAt: null, views: 17, deleted: false, comments: [] }
];

/**
 * `postRequests` / `commentRequests`: `${memberId}:${requestId}` → the post / comment that request created, so a retry
 * after a lost response creates one record (a 재가입 moves the withdrawn account's keys to its own id, account/rejoin.ts).
 */
type Store = { posts: MockPost[]; postRequests: Record<string, string>; commentRequests: Record<string, string> };
// V2: request ids for 글쓰기 and 댓글.
const g = globalThis as typeof globalThis & { __ssumnationMockCommunityV2?: Store };

export const mockCommunity = (g.__ssumnationMockCommunityV2 ??= { posts: structuredClone(seed), postRequests: {}, commentRequests: {} });
