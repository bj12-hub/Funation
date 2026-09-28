import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { Platform } from "@/types/platform";

/**
 * Live channel list contract.
 * Figma: funation-all-live-page 617:316 (전체라이브), funation-popular-live-page 617:5 (인기라이브)
 * Platform DTOs are mapped to these types on the server (PlatformAdapter), never passed through.
 */

export type LiveCategory =
  | "NEWS_ECONOMY"
  | "MUSIC_DANCE"
  | "GAME"
  | "DAILY_TRAVEL"
  | "FINANCE"
  | "MUKBANG"
  | "TALK"
  | "SPORTS"
  | "VARIETY"
  | "VIRTUAL";

/** Badge labels as written in Figma 617:437. */
export const LIVE_CATEGORY_LABEL: Record<LiveCategory, string> = {
  NEWS_ECONOMY: "시사/경제",
  MUSIC_DANCE: "음악/댄스",
  GAME: "게임",
  DAILY_TRAVEL: "일상/여행",
  FINANCE: "금융",
  MUKBANG: "먹방",
  TALK: "토크",
  SPORTS: "스포츠",
  VARIETY: "예능",
  VIRTUAL: "버츄얼"
};

export type LiveChannel = {
  id: string;
  title: string;
  channelName: string;
  channelAvatarUrl: string;
  thumbnailUrl: string;
  viewerCount: number;
  platform: Platform;
  category: LiveCategory;
  /** Seconds since the broadcast started, computed on the server when the list is fetched. */
  elapsedSeconds: number;
  href: string;
};

export type PopularLiveSection = {
  category: LiveCategory;
  title: string;
  channels: LiveChannel[];
};

export async function getAllLiveChannels(): Promise<LiveChannel[]> {
  if (!USE_MOCK) throw new Error("Live channel API is not connected yet.");
  await mockDelay(300);
  return MOCK_ALL_LIVE;
}

export async function getPopularLiveSections(): Promise<PopularLiveSection[]> {
  if (!USE_MOCK) throw new Error("Live channel API is not connected yet.");
  await mockDelay(300);
  return MOCK_POPULAR;
}

// ── Mock data: copy and images from Figma 617:316 / 617:5 ─────────────────────
// Platforms are not shown in Figma and are spread across the three for filter testing.
// Live detail routes do not exist yet, so every channel links to /live.

const T = (n: number) => `/mock/live/thumb-${n}.jpg`;
const A = (n: number) => `/mock/live/avatar-${n}.png`;
const ELAPSED = 6300; // "01:45:00" in every Figma card

type Seed = [id: string, title: string, channel: string, viewers: number, category: LiveCategory, thumb: number, avatar: number, platform: Platform];

const channel = ([id, title, channelName, viewerCount, category, thumb, avatar, platform]: Seed): LiveChannel => ({
  id,
  title,
  channelName,
  channelAvatarUrl: A(avatar),
  thumbnailUrl: T(thumb),
  viewerCount,
  platform,
  category,
  elapsedSeconds: ELAPSED,
  href: "/live"
});

const MOCK_ALL_LIVE: LiveChannel[] = (
  [
    ["a1", "[생방송] 소비자물가지수(CPI) 발표 긴급 분석! 미 증시 대격변 라이브", "경제를 알다 경제TV", 44_829, "NEWS_ECONOMY", 1, 1, "YOUTUBE"],
    ["a2", "[스타일크루LIVE] 공식 라이브! 매 레전드 갱신 중! #댄스 챌린지", "스타일크루 STYLE CREW", 8_942, "MUSIC_DANCE", 2, 2, "SOOP"],
    ["a3", "[인피쉰 생방송 Live] 스타 빠른무한 3:3 공방 브레인 대전", "인피쉰", 7_240, "GAME", 3, 1, "SOOP"],
    ["a4", "LIVE) 비트코인 역대 최고가 갱신 직전 분석 릴레이 브리핑", "스트리머 사또 live-streamer satto", 4_274, "NEWS_ECONOMY", 4, 3, "YOUTUBE"],
    ["a5", "es HIDDEN GEM EUROPE MOTORBIKE TRIP : ...", "Jinnytty", 3_726, "DAILY_TRAVEL", 1, 4, "FLEXTV"],
    ["a6", "비트코인(Live) CPI 큰거온다..나 살아남을 수 있을까", "뱁구", 3_140, "NEWS_ECONOMY", 4, 3, "SOOP"],
    ["a7", "비트코인 실시간) CPI 아직도 믿으세요? 시장 분석 대응방안", "웨돔의 비트코인", 2_825, "FINANCE", 3, 1, "YOUTUBE"],
    ["a8", "[미국주식 LIVE] 8월 CPI, 같이봅시다! 긴급분석", "설명왕_테이버", 2_500, "NEWS_ECONOMY", 5, 5, "FLEXTV"],
    ["a9", "오클랜드2", "시수기릿[girit]", 2_080, "MUKBANG", 5, 5, "SOOP"],
    ["a10", "쉬는날에 영화나볼까? 팝콘같은 남자들 데이트룩 사복 코디", "킹스맨레블", 2_039, "TALK", 6, 6, "FLEXTV"],
    ["a11", "이클립스 패키지 마저 질러봅니다", "센터로드TV", 2_014, "GAME", 7, 2, "SOOP"],
    ["a12", "당구는 해커 방송만 보셔도 고수가 됩니다", "당구해커", 1_996, "SPORTS", 7, 2, "YOUTUBE"],
    ["a13", "[생] 이번 아들둘 매엄마 나쁜놈 빵실이 ...", "이로이", 1_870, "TALK", 6, 6, "SOOP"],
    ["a14", "[해외선물 실시간] 해외선물 타신 실시간 라이브 트레이딩", "해외선물 타신", 1_700, "FINANCE", 8, 7, "YOUTUBE"],
    ["a15", "준용x키리 간단한 술 토크 #엑셀 #남자..", "라인업 키리", 1_693, "VARIETY", 2, 2, "FLEXTV"]
  ] satisfies Seed[]
).map(channel);

// Figma 617:5 shows four cards per section; extra cards (revealed by 더보기) reuse the pool above.
const MOCK_POPULAR: PopularLiveSection[] = [
  {
    category: "MUSIC_DANCE",
    title: "추천 음악/댄스 채널",
    channels: (
      [
        ["p1", "[스타일크루LIVE] 공식 라이브! 매 레전드 갱신 중! #댄스", "스타일크루 STYLE CREW", 8_942, "MUSIC_DANCE", 2, 2, "SOOP"],
        ["p2", "쉬는날에 영화나볼까? 팝콘같은 남자들 데이트룩 사복...", "킹스맨레블", 2_039, "MUSIC_DANCE", 6, 6, "FLEXTV"],
        ["p3", "[앙스티보이즈 12회차] 코스프레 뉴시그 Day", "[앙엔터] 양양~진국 (Jinguk)", 739, "MUSIC_DANCE", 4, 3, "SOOP"],
        ["p4", "이노레이블x김인호 4화 직급프리데이 2라운드 팀 식...", "김인호의 이노레이블", 695, "MUSIC_DANCE", 8, 5, "YOUTUBE"],
        ["p5", "준용x키리 간단한 술 토크 #엑셀 #남자..", "라인업 키리", 612, "MUSIC_DANCE", 2, 2, "FLEXTV"]
      ] satisfies Seed[]
    ).map(channel)
  },
  {
    category: "TALK",
    title: "추천 토크 채널",
    channels: (
      [
        ["p6", "es HIDDEN GEM EUROPE MOTORBIKE TRIP : ...", "Jinnytty", 3_726, "TALK", 1, 4, "FLEXTV"],
        ["p7", "오클랜드2", "시수기릿[girit]", 2_080, "TALK", 5, 5, "SOOP"],
        ["p8", "2026.09.11 장추자 라이브", "장추자", 1_580, "TALK", 2, 1, "YOUTUBE"],
        ["p9", "금요일 생방송 소통", "꽃자", 1_129, "TALK", 7, 7, "SOOP"],
        ["p10", "[생] 이번 아들둘 매엄마 나쁜놈 빵실이 ...", "이로이", 1_870, "TALK", 6, 6, "SOOP"]
      ] satisfies Seed[]
    ).map(channel)
  },
  {
    category: "VIRTUAL",
    title: "추천 버츄얼 채널",
    channels: (
      [
        ["p11", "❇ 영도데이라래!", "빵룽", 103, "VIRTUAL", 3, 1, "SOOP"],
        ["p12", "🍉 아고고구마 마이크 바꿨어용", "에렌디라", 85, "VIRTUAL", 4, 3, "SOOP"],
        ["p13", "러스트 공식 첫날 생존기", "요루하나", 41, "VIRTUAL", 7, 2, "YOUTUBE"],
        ["p14", "[저녁뱅펜~][엔드필드 이본 그리는중~]", "ARENBEE", 30, "VIRTUAL", 6, 6, "FLEXTV"]
      ] satisfies Seed[]
    ).map(channel)
  }
];
