import { USE_MOCK, mockDelay } from "@/lib/mock";
import { CREATOR_CATEGORY_LABEL, getCreatorById } from "@/services/creators/creators";
import type { Platform } from "@/types/platform";

/**
 * Home feed contract (Figma 727:2742).
 * One request returns every home section so the page renders in a single round trip.
 * Platform-specific DTOs must be mapped to these types on the server (see PlatformAdapter).
 */

export type { Platform } from "@/types/platform";

export type HeroSlide = {
  id: string;
  imageUrl: string;
  badge: string;
  highlight?: string;
  title: string;
  description?: string;
  viewerCount: number;
  recommendCount?: number;
  href: string;
};

export type TrendingVideo = {
  id: string;
  rank: number;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  viewerCount: number;
  isLive: boolean;
  href: string;
};

export type RankedLive = {
  id: string;
  rank: number;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  viewerCount: number;
  href: string;
};

export type PopularCreator = {
  id: string;
  name: string;
  avatarUrl: string;
  subscriberCount: number;
  href: string;
  /** Figma 688:646 크리에이터 프로필 popup. */
  profile: {
    verified: boolean;
    /** One-line status under the name. */
    status: string;
    tags: string[];
    channels: { platform: Platform; logoUrl: string }[];
  };
};

/**
 * Arrival notices shown as a carousel over the home page (Figma 200:115 · 200:223).
 * Copy is server content so operations can change it without a release.
 */
export type HomeNotice =
  | { id: string; kind: "ID_CONNECT"; badge: string; titleAccent: string; title: string }
  | {
      id: string;
      kind: "FRAUD_WARNING";
      tag: string;
      title: string;
      lead: string;
      emphasis: string;
      callout: string;
      bullets: string[];
    };

export type Promotion = {
  id: string;
  imageUrl: string;
  label: string;
  title: string;
  description: string;
  ctaLabel: string;
  /** Destination is TBD in Figma; the CTA renders as unavailable without it. */
  href?: string;
};

export type HomeFeed = {
  heroSlides: HeroSlide[];
  trending: TrendingVideo[];
  ranking: RankedLive[];
  creators: PopularCreator[];
  promotion: Promotion | null;
  notices: HomeNotice[];
};

export async function getHomeFeed(): Promise<HomeFeed> {
  if (!USE_MOCK) throw new Error("Home feed API is not connected yet.");
  await mockDelay(300);
  const creators = await Promise.all(
    MOCK_HOME_FEED.creators.map(async (c) => {
      const detail = await getCreatorById(c.id);
      return {
        ...c,
        profile: {
          verified: true,
          status: detail?.description ?? "",
          tags: (detail?.categories ?? []).map((k) => `#${CREATOR_CATEGORY_LABEL[k]}`),
          channels: MOCK_CHANNELS
        }
      };
    })
  );
  return { ...MOCK_HOME_FEED, creators, notices: MOCK_NOTICES };
}

// ── Mock data ──────────────────────────────────────────────────────────────────
// Layout follows Figma 727:2742. The service is about personal broadcasts and 엑셀방송 (crew broadcasts
// ranked by donations), so every channel is a fictional streamer or crew and the images are original
// illustrations (scripts/mock-images). Live detail routes do not exist yet, so every broadcast links to /live.

const IMG = "/mock/home";

const MOCK_TRENDING: TrendingVideo[] = [
  { id: "t1", rank: 1, thumbnailUrl: `${IMG}/trending-1.jpg`, title: "[엑셀방송] 불꽃크루 시즌2 4회차 — 직급전 막판 순위 역전!", channelName: "불꽃크루", viewerCount: 3_920, isLive: true, href: "/live" },
  { id: "t2", rank: 2, thumbnailUrl: `${IMG}/trending-2.jpg`, title: "금요일 밤 소통 방송 · 오늘의 사연 읽어요", channelName: "하루봄", viewerCount: 2_410, isLive: true, href: "/live" },
  { id: "t3", rank: 3, thumbnailUrl: `${IMG}/trending-3.jpg`, title: "시청자 추천 메뉴로 야식 먹방 · 매운맛 퀘스트 도전", channelName: "먹깨비소이", viewerCount: 1_540, isLive: true, href: "/live" },
  { id: "t4", rank: 4, thumbnailUrl: `${IMG}/trending-4.jpg`, title: "다이아 찍을 때까지 랭크 · 시참 환영", channelName: "밤톨게임", viewerCount: 1_290, isLive: true, href: "/live" }
];

// Profiles and notices are added in getHomeFeed.
const MOCK_HOME_FEED: Omit<HomeFeed, "creators" | "notices"> & { creators: Omit<PopularCreator, "profile">[] } = {
  heroSlides: [
    {
      id: "h1",
      imageUrl: `${IMG}/hero-1.jpg`,
      badge: "엑셀방송",
      highlight: "실시간 인기 1위",
      title: "불꽃크루 엑셀방송 시즌2 결승 생방송!",
      description: "6인 크루의 직급이 오늘 밤 결정돼요. 실시간 점수판으로 순위를 확인하고, 응원하는 멤버에게 후원해 보세요.",
      viewerCount: 3_920,
      recommendCount: 1_280,
      href: "/live"
    },
    // Figma shows four carousel dots but only the first slide; the rest reuse trending items.
    ...[1, 2, 3].map((i) => {
      const video = MOCK_TRENDING[i];
      return {
        id: `h-${video.id}`,
        imageUrl: video.thumbnailUrl,
        badge: "LIVE",
        highlight: video.channelName,
        title: video.title,
        viewerCount: video.viewerCount,
        href: video.href
      };
    })
  ],
  trending: MOCK_TRENDING,
  ranking: [
    { id: "r1", rank: 1, thumbnailUrl: `${IMG}/trending-1.jpg`, title: "불꽃크루 엑셀방송 시즌2 4회차 · 직급전", channelName: "불꽃크루", viewerCount: 3_920, href: "/live" },
    { id: "r2", rank: 2, thumbnailUrl: `${IMG}/live-3.jpg`, title: "별빛크루 댄스 엑셀 · 팀 배틀 1부", channelName: "별빛크루", viewerCount: 2_870, href: "/live" },
    { id: "r3", rank: 3, thumbnailUrl: `${IMG}/trending-2.jpg`, title: "금요일 밤 소통 방송 · 오늘의 사연", channelName: "하루봄", viewerCount: 2_410, href: "/live" },
    { id: "r4", rank: 4, thumbnailUrl: `${IMG}/live-1.jpg`, title: "신청곡 받는 라이브 노래방", channelName: "도도쭈", viewerCount: 1_830, href: "/live" },
    { id: "r5", rank: 5, thumbnailUrl: `${IMG}/ranking-5.jpg`, title: "토끼 귀 버츄얼의 그림 그리기 방송", channelName: "린토끼", viewerCount: 640, href: "/live" }
  ],
  creators: [
    { id: "c4", name: "불꽃크루", avatarUrl: `${IMG}/creator-1.png`, subscriberCount: 91_000, href: "/creators/c4" },
    { id: "c1", name: "하루봄", avatarUrl: `${IMG}/creator-2.png`, subscriberCount: 48_000, href: "/creators/c1" },
    { id: "c2", name: "도도쭈", avatarUrl: `${IMG}/creator-3.png`, subscriberCount: 36_000, href: "/creators/c2" },
    { id: "c3", name: "밤톨게임", avatarUrl: `${IMG}/creator-4.png`, subscriberCount: 27_000, href: "/creators/c3" },
    { id: "c10", name: "별빛크루", avatarUrl: `${IMG}/creator-5.png`, subscriberCount: 64_000, href: "/creators/c10" },
    { id: "c6", name: "먹깨비소이", avatarUrl: `${IMG}/creator-6.png`, subscriberCount: 33_000, href: "/creators/c6" }
  ],
  promotion: {
    id: "p1",
    imageUrl: `${IMG}/promo-banner.jpg`,
    label: "이벤트",
    title: "크루 방송 시즌 오픈 기념 이벤트",
    description: "엑셀방송에 참여한 시청자를 위한 시즌 이벤트예요. 보상 내용은 확정되면 안내돼요 (TBD).",
    ctaLabel: "이벤트 보기",
    // Code-first: the events page (the specific promotion page is still TBD).
    href: "/events"
  }
};

// 688:646 channel chips; the same mock logos as the creator room.
const MOCK_CHANNELS: PopularCreator["profile"]["channels"] = [
  { platform: "YOUTUBE", logoUrl: "/mock/room/logo-youtube.png" },
  { platform: "SOOP", logoUrl: "/mock/room/logo-soop.png" },
  { platform: "FLEXTV", logoUrl: "/mock/room/logo-flextv.png" }
];

// 200:115 · 200:223 copy. The first slide of the Figma carousel is missing from the file.
const MOCK_NOTICES: HomeNotice[] = [
  { id: "n-id-connect", kind: "ID_CONNECT", badge: "ID CONNECTION", titleAccent: "썸네이션 ID로", title: "꼭 연결해 주세요!" },
  {
    id: "n-fraud",
    kind: "FRAUD_WARNING",
    tag: "보이스피싱 경고",
    title: "썸네이션 사칭 / 사기 주의 안내",
    lead: "최근 당사를 사칭하여 입금을 요구하는 보이스피싱 사례가 확인되고 있습니다.",
    emphasis: "썸네이션은 개인의 자금을 직접 요구하거나 처리하는 업무를 절대 진행하지 않습니다.",
    callout: "따라서 아래와 같은 요청을 받으신 경우 즉시 응대 중단 및 썸네이션 고객센터로 확인해주시기 바랍니다.",
    bullets: ["정산 소유권 양도 요구", "보증보험료·각종 수수료 납부 요청", "썸네이션 FN 및 그 외 금전 송금을 유도하는 모든 연락"]
  }
];
