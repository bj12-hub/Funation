import { USE_MOCK, mockDelay } from "@/lib/mock";

/**
 * Creator directory contract.
 * Figma: funation-all-creators-page 690:5 (route `/creators`)
 * Filtering, search, sorting and paging are server-side; the page passes URL params through.
 */

export type CreatorCategory = "VARIETY" | "TRAVEL" | "DRAMA" | "SPORTS" | "MUSIC" | "GAME" | "MUKBANG" | "DAILY";

/** Tab order and labels from Figma 690:5 category tabs. */
export const CREATOR_CATEGORY_LABEL: Record<CreatorCategory, string> = {
  VARIETY: "예능",
  TRAVEL: "여행",
  DRAMA: "드라마",
  SPORTS: "스포츠",
  MUSIC: "뮤직",
  GAME: "게임",
  MUKBANG: "먹방",
  DAILY: "일상"
};

/**
 * Sort options follow funnation 크리에이터 찾기 (인기순 · 라이브 · 최신순).
 * 인기순 = subscribers (TBD: a site follower count once follows exist); 라이브 = only live creators by
 * viewers; 최신순 = most recently joined.
 */
export type CreatorSort = "popular" | "live" | "recent";

export const CREATOR_SORT_LABEL: Record<CreatorSort, string> = {
  popular: "인기순",
  live: "라이브",
  recent: "최신순"
};

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
  return MOCK_CREATORS.find((c) => c.id === id) ?? null;
}

export async function getCreators({ category, query, sort = "popular", page = 1 }: CreatorQuery): Promise<CreatorPage> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  await mockDelay(300);

  const keyword = query?.trim().toLowerCase();
  const filtered = MOCK_CREATORS.filter(
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
    liveCount: MOCK_CREATORS.filter((c) => c.isLive).length
  };
}

// ── Mock data: copy and images from Figma 690:5 ───────────────────────────────
// Subscriber counts for c1–c6 follow the home screen (727:2742); c7–c10 are sample values.

const A = (n: number) => `/mock/creators/creator-${n}.png`;

const MOCK_CREATORS: CreatorSummary[] = [
  { id: "c1", name: "침착맨", avatarUrl: A(1), description: "삼국지 및 일상 토크 최강자", categories: ["VARIETY", "TRAVEL", "DRAMA"], isLive: true, isNew: false, viewerCount: 14_820, subscriberCount: 2_600_000, joinedAt: "2024-03-02", ring: "brand" },
  { id: "c2", name: "곽튜브", avatarUrl: A(2), description: "힐링과 유머 가득한 세계 여행 브이로그", categories: ["TRAVEL", "SPORTS"], isLive: true, isNew: false, viewerCount: 18_430, subscriberCount: 1_950_000, joinedAt: "2024-05-11", ring: "plain" },
  { id: "c3", name: "빠니보틀", avatarUrl: A(3), description: "날것 그대로의 해외 생존 여행기", categories: ["TRAVEL", "MUSIC"], isLive: true, isNew: false, viewerCount: 12_760, subscriberCount: 2_400_000, joinedAt: "2024-07-20", ring: "plain" },
  { id: "c4", name: "피식대학", avatarUrl: A(4), description: "글로벌 쇼 및 다채로운 캐릭터 코미디", categories: ["VARIETY", "GAME", "MUKBANG"], isLive: true, isNew: false, viewerCount: 19_210, subscriberCount: 3_050_000, joinedAt: "2024-09-08", ring: "brand" },
  { id: "c5", name: "워크맨", avatarUrl: A(5), description: "세상의 모든 직업 알바 체험기", categories: ["VARIETY", "DRAMA"], isLive: true, isNew: false, viewerCount: 16_980, subscriberCount: 4_100_000, joinedAt: "2025-01-15", ring: "plain" },
  { id: "c6", name: "먹방 쯔양", avatarUrl: A(6), description: "기록적인 대식과 따뜻한 소통 먹방", categories: ["MUKBANG", "VARIETY", "DAILY"], isLive: true, isNew: false, viewerCount: 11_540, subscriberCount: 9_800_000, joinedAt: "2025-03-30", ring: "plain" },
  { id: "c7", name: "테크마스터", avatarUrl: A(7), description: "가장 빠르고 상세한 신제품 리뷰", categories: ["GAME", "SPORTS"], isLive: false, isNew: true, viewerCount: null, subscriberCount: 420_000, joinedAt: "2026-08-21", ring: "new" },
  { id: "c8", name: "댕댕하우스", avatarUrl: A(8), description: "귀여운 강아지 형제들의 매일매일", categories: ["DAILY", "VARIETY"], isLive: true, isNew: false, viewerCount: 9_310, subscriberCount: 880_000, joinedAt: "2025-11-02", ring: "plain" },
  { id: "c9", name: "맛있는 하루", avatarUrl: A(9), description: "숨겨진 로컬 맛집과 야시장 정복", categories: ["MUKBANG", "TRAVEL", "DAILY"], isLive: false, isNew: true, viewerCount: null, subscriberCount: 310_000, joinedAt: "2026-09-05", ring: "new" },
  { id: "c10", name: "STAR BEATS", avatarUrl: A(10), description: "케이팝 댄스 및 초고화질 퍼포먼스 전문", categories: ["MUSIC", "VARIETY"], isLive: true, isNew: false, viewerCount: 13_240, subscriberCount: 1_270_000, joinedAt: "2026-02-14", ring: "plain" }
];
