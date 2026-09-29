import { USE_MOCK, mockDelay } from "@/lib/mock";
import { CREATOR_CATEGORY_LABEL, getCreatorById } from "@/services/creators/creators";
import type { Platform } from "@/types/platform";

/**
 * Home feed contract (Figma 727:2742).
 * One request returns every home section so the page renders in a single round trip.
 * Platform-specific DTOs must be mapped to these types on the server (see PlatformAdapter).
 */

export type { Platform } from "@/types/platform";

export type LiveCategory = "VARIETY" | "DRAMA" | "SPORTS" | "MUSIC" | "GAME" | "MUKBANG" | "DAILY";

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

export type LiveBroadcast = {
  id: string;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  channelAvatarUrl: string;
  viewerCount: number;
  platform: Platform;
  category: LiveCategory;
  href: string;
};

export type HomeFeed = {
  heroSlides: HeroSlide[];
  trending: TrendingVideo[];
  ranking: RankedLive[];
  creators: PopularCreator[];
  promotion: Promotion | null;
  liveBroadcasts: LiveBroadcast[];
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

// ── Mock data: copy and images from Figma 727:2742 ────────────────────────────
// Live detail routes do not exist yet, so every broadcast links to /live.

const IMG = "/mock/home";

const MOCK_TRENDING: TrendingVideo[] = [
  { id: "t1", rank: 1, thumbnailUrl: `${IMG}/trending-1.jpg`, title: "스페셜 컴백 무대: NEXT WAVE 신곡 쇼케이스 현장 LIVE", channelName: "Mnet M2", viewerCount: 19_200, isLive: true, href: "/live" },
  { id: "t2", rank: 2, thumbnailUrl: `${IMG}/trending-2.jpg`, title: "길거리 토크쇼: 레전드 찍은 역대급 입담의 고등학생 게스트", channelName: "스튜디오 룰루랄라", viewerCount: 14_400, isLive: true, href: "/live" },
  { id: "t3", rank: 3, thumbnailUrl: `${IMG}/trending-3.jpg`, title: "산더미 통문어 해물탕 역대급 비주얼과 매콤 국물 폭풍 먹방", channelName: "도로시MUKBANG", viewerCount: 9_800, isLive: true, href: "/live" },
  { id: "t4", rank: 4, thumbnailUrl: `${IMG}/trending-4.jpg`, title: "[K리그] 손에 땀을 쥐는 매치: 후반 추가시간 극장 동점골!", channelName: "KLEAGUE TV", viewerCount: 8_500, isLive: true, href: "/live" }
];

// Profiles and notices are added in getHomeFeed.
const MOCK_HOME_FEED: Omit<HomeFeed, "creators" | "notices"> & { creators: Omit<PopularCreator, "profile">[] } = {
  heroSlides: [
    {
      id: "h1",
      imageUrl: `${IMG}/hero-1.jpg`,
      badge: "추천 예능",
      highlight: "실시간 인기 급상승 1위",
      title: "플레이 그라운드 K-스타 리그 결승전 특집 생중계!",
      description: "올해 가장 핫한 아이돌 그룹들이 총출동하는 글로벌 스포츠 대축제. 역대급 예능 매치와 특별 합동 무대 단독 라이브!",
      viewerCount: 245_000,
      recommendCount: 98_000,
      href: "/live"
    },
    // Figma shows four carousel dots but only the first slide; the rest reuse trending items.
    ...[0, 1, 3].map((i) => {
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
    { id: "r1", rank: 1, thumbnailUrl: `${IMG}/trending-1.jpg`, title: "뮤직뱅크 글로벌 스테이지 — NOVA 컴백 무대 LIVE", channelName: "KBS Kpop", viewerCount: 12_842, href: "/live" },
    { id: "r2", rank: 2, thumbnailUrl: `${IMG}/trending-2.jpg`, title: "홍대 한복판 깜짝 인터뷰! 시민 토크 배틀 생중계", channelName: "스튜디오 룰루랄라", viewerCount: 9_731, href: "/live" },
    { id: "r3", rank: 3, thumbnailUrl: `${IMG}/trending-3.jpg`, title: "제주 해산물 한상 10인분 도전! 야식 먹방 LIVE", channelName: "도로시MUKBANG", viewerCount: 7_486, href: "/live" },
    { id: "r4", rank: 4, thumbnailUrl: `${IMG}/trending-4.jpg`, title: "프로농구 챔피언 결정전 4쿼터 실시간 중계", channelName: "SPOTV NOW", viewerCount: 5_218, href: "/live" },
    { id: "r5", rank: 5, thumbnailUrl: `${IMG}/ranking-5.jpg`, title: "고양이 구조센터 새 가족 만나는 날 — 입양 라이브", channelName: "냥이들의천국", viewerCount: 3_904, href: "/live" }
  ],
  creators: [
    { id: "c4", name: "피식대학", avatarUrl: `${IMG}/creator-1.png`, subscriberCount: 3_050_000, href: "/creators/c4" },
    { id: "c3", name: "빠니보틀", avatarUrl: `${IMG}/creator-2.png`, subscriberCount: 2_400_000, href: "/creators/c3" },
    { id: "c5", name: "워크맨", avatarUrl: `${IMG}/creator-3.png`, subscriberCount: 4_100_000, href: "/creators/c5" },
    { id: "c1", name: "침착맨", avatarUrl: `${IMG}/creator-4.png`, subscriberCount: 2_600_000, href: "/creators/c1" },
    { id: "c2", name: "곽튜브", avatarUrl: `${IMG}/creator-5.png`, subscriberCount: 1_950_000, href: "/creators/c2" },
    { id: "c6", name: "먹방 쯔양", avatarUrl: `${IMG}/creator-6.png`, subscriberCount: 9_800_000, href: "/creators/c6" }
  ],
  promotion: {
    id: "p1",
    imageUrl: `${IMG}/promo-banner.jpg`,
    label: "이벤트",
    title: "썸네이션 첫 결제 프로모션! 프리미엄 1개월 무료 체험",
    description: "지금 구독하면 광고 없는 초고화질 무제한 스트리밍이 첫 달 무료! 최신 오리지널 예능 단독 오픈.",
    ctaLabel: "지금 참여하기",
    // Code-first: the events page (the specific promotion page is still TBD).
    href: "/events"
  },
  liveBroadcasts: [
    { id: "l1", thumbnailUrl: `${IMG}/live-1.jpg`, title: "라이브 무대에서 가슴이 웅장해지는 보이스를 전달하는 신예 싱어송라이터", channelName: "온스테이지 코리아", channelAvatarUrl: `${IMG}/live-avatar-1.png`, viewerCount: 124_000, platform: "YOUTUBE", category: "MUSIC", href: "/live" },
    { id: "l2", thumbnailUrl: `${IMG}/live-2.jpg`, title: "화제의 막장 드라마 충격 고백 씬을 라이브로 분석하고 반응하는 방송", channelName: "DRAMA CLICK", channelAvatarUrl: `${IMG}/live-avatar-2.png`, viewerCount: 87_000, platform: "YOUTUBE", category: "DRAMA", href: "/live" },
    { id: "l3", thumbnailUrl: `${IMG}/live-3.jpg`, title: "결승 4쿼터 대역전 극장 버저비터 하이라이트를 라이브로 분석하는 방송", channelName: "스포티비 라이트", channelAvatarUrl: `${IMG}/live-avatar-3.png`, viewerCount: 52_000, platform: "YOUTUBE", category: "SPORTS", href: "/live" },
    { id: "l4", thumbnailUrl: `${IMG}/live-4.jpg`, title: "주인 퇴근하자 100미터 전부터 꼬리 흔드는 강아지 브이로그 라이브", channelName: "댕댕하우스", channelAvatarUrl: `${IMG}/live-avatar-4.png`, viewerCount: 38_000, platform: "YOUTUBE", category: "DAILY", href: "/live" },
    { id: "l5", thumbnailUrl: `${IMG}/live-5.jpg`, title: "프로게이머도 경악한 역대급 한타 명장면을 라이브로 분석하는 방송", channelName: "게임마스터", channelAvatarUrl: `${IMG}/live-avatar-5.png`, viewerCount: 91_000, platform: "YOUTUBE", category: "GAME", href: "/live" },
    { id: "l6", thumbnailUrl: `${IMG}/live-6.jpg`, title: "서울에서 가장 오래된 역대급 두툼 삼겹살 맛집을 라이브로 탐방하는 방송", channelName: "미식가들의 세상", channelAvatarUrl: `${IMG}/live-avatar-6.png`, viewerCount: 65_000, platform: "YOUTUBE", category: "MUKBANG", href: "/live" }
  ]
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
