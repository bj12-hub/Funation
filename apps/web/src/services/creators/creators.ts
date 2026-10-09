import { USE_MOCK, mockDelay } from "@/lib/mock";
import { isCreatorSuspended } from "@/services/admin/memberCore";
import type { CreatorCategory, CreatorSort } from "./creatorTypes";

export { CREATOR_CATEGORY_LABEL, CREATOR_SORT_LABEL, type CreatorCategory, type CreatorSort } from "./creatorTypes";

/**
 * Creator directory contract.
 * Figma: ssumnation-all-creators-page 690:5 (route `/creators`)
 * Filtering, search, sorting and paging are server-side; the page passes URL params through.
 */

export type CreatorSummary = {
  id: string;
  name: string;
  avatarUrl: string;
  description: string;
  categories: CreatorCategory[];
  isLive: boolean;
  isNew: boolean;
  /** Current viewers while live; `null` when offline. */
  viewerCount: number | null;
  subscriberCount: number;
  /** When the creator joined (YYYY-MM-DD), for 최신순. */
  joinedAt: string;
  /**
   * Avatar ring in Figma: brand gradient, cyan (new creators) or plain.
   * TODO: the rule for the brand ring is not defined yet; the mock mirrors Figma.
   */
  ring: "brand" | "new" | "plain";
};

export type CreatorQuery = {
  category?: CreatorCategory;
  query?: string;
  sort?: CreatorSort;
  page?: number;
};

export type CreatorPage = {
  items: CreatorSummary[];
  page: number;
  totalPages: number;
  totalCount: number;
  /** Creators live right now across the whole directory ("지금 N명이 방송 중이에요"). */
  liveCount: number;
};

export const CREATORS_PAGE_SIZE = 10;

/** Single creator by id, or `null`. */
export async function getCreatorById(id: string): Promise<CreatorSummary | null> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  // 운영 정책에 따라 정지된 크리에이터의 채널은 공개 화면에서 사라져요 (TBD: 안내 페이지).
  return MOCK_CREATORS.find((c) => c.id === id && !isCreatorSuspended(c.id)) ?? null;
}

/** Admin console only: every creator, suspended ones included (callers must check the Admin role). */
export async function getAllCreatorsForAdmin(): Promise<CreatorSummary[]> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  return MOCK_CREATORS.map((c) => ({ ...c }));
}

export async function getCreators({ category, query, sort = "popular", page = 1 }: CreatorQuery): Promise<CreatorPage> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  await mockDelay(300);

  const keyword = query?.trim().toLowerCase();
  const visible = MOCK_CREATORS.filter((c) => !isCreatorSuspended(c.id));
  const filtered = visible.filter(
    (c) =>
      (!category || c.categories.includes(category)) &&
      (!keyword || c.name.toLowerCase().includes(keyword) || c.description.toLowerCase().includes(keyword))
  )
    .filter((c) => sort !== "live" || c.isLive)
    .sort((a, b) => {
      if (sort === "live") return (b.viewerCount ?? 0) - (a.viewerCount ?? 0);
      if (sort === "recent") return b.joinedAt.localeCompare(a.joinedAt) || a.name.localeCompare(b.name, "ko");
      return b.subscriberCount - a.subscriberCount;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / CREATORS_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return {
    items: filtered.slice((current - 1) * CREATORS_PAGE_SIZE, current * CREATORS_PAGE_SIZE),
    page: current,
    totalPages,
    totalCount: filtered.length,
    liveCount: visible.filter((c) => c.isLive).length
  };
}

// ── Mock data ──────────────────────────────────────────────────────────────────
// Fictional personal broadcasters and 엑셀방송 crews (the service focus); no real creators.
// Layout follows Figma 690:5. Avatars are original illustrations (scripts/mock-images).

const A = (n: number) => `/mock/creators/creator-${n}.png`;

const MOCK_CREATORS: CreatorSummary[] = [
  { id: "c1", name: "하루봄", avatarUrl: A(1), description: "매일 밤 9시, 수다로 하루를 마무리하는 소통 방송", categories: ["VARIETY", "DAILY"], isLive: true, isNew: false, viewerCount: 2_410, subscriberCount: 48_000, joinedAt: "2024-03-02", ring: "brand" },
  { id: "c2", name: "도도쭈", avatarUrl: A(2), description: "신청곡 받아 부르는 라이브 노래방", categories: ["MUSIC", "VARIETY"], isLive: true, isNew: false, viewerCount: 1_830, subscriberCount: 36_000, joinedAt: "2024-05-11", ring: "plain" },
  { id: "c3", name: "밤톨게임", avatarUrl: A(3), description: "시청자랑 같이 랭크 올리는 게임 개인방송", categories: ["GAME"], isLive: true, isNew: false, viewerCount: 1_290, subscriberCount: 27_000, joinedAt: "2024-07-20", ring: "plain" },
  { id: "c4", name: "불꽃크루", avatarUrl: A(4), description: "6인 엑셀방송 크루 · 매주 금·토 시즌제 직급전", categories: ["VARIETY", "MUSIC"], isLive: true, isNew: false, viewerCount: 3_920, subscriberCount: 91_000, joinedAt: "2024-09-08", ring: "brand" },
  { id: "c5", name: "새벽감성", avatarUrl: A(5), description: "사연 읽어 주는 잔잔한 새벽 라디오 토크", categories: ["VARIETY", "DAILY"], isLive: true, isNew: false, viewerCount: 980, subscriberCount: 21_000, joinedAt: "2025-01-15", ring: "plain" },
  { id: "c6", name: "먹깨비소이", avatarUrl: A(6), description: "시청자 추천 메뉴로 달리는 야식 먹방", categories: ["MUKBANG", "DAILY"], isLive: true, isNew: false, viewerCount: 1_540, subscriberCount: 33_000, joinedAt: "2025-03-30", ring: "plain" },
  { id: "c7", name: "린토끼", avatarUrl: A(7), description: "그림 그리며 수다 떠는 버츄얼 방송", categories: ["GAME", "DAILY"], isLive: false, isNew: true, viewerCount: null, subscriberCount: 8_400, joinedAt: "2026-08-21", ring: "new" },
  { id: "c8", name: "댕댕하우스", avatarUrl: A(8), description: "강아지 형제와 함께하는 일상 개인방송", categories: ["DAILY", "VARIETY"], isLive: true, isNew: false, viewerCount: 760, subscriberCount: 15_000, joinedAt: "2025-11-02", ring: "plain" },
  { id: "c9", name: "맛있는 하루", avatarUrl: A(9), description: "동네 맛집 포장해서 같이 먹는 먹방", categories: ["MUKBANG", "DAILY"], isLive: false, isNew: true, viewerCount: null, subscriberCount: 6_200, joinedAt: "2026-09-05", ring: "new" },
  { id: "c10", name: "별빛크루", avatarUrl: A(10), description: "댄스 엑셀방송 크루 · 직급전과 팀 배틀", categories: ["MUSIC", "VARIETY"], isLive: true, isNew: false, viewerCount: 2_870, subscriberCount: 64_000, joinedAt: "2026-02-14", ring: "plain" }
];
