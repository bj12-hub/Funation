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

// ── Mock data: layout from Figma 617:316 / 617:5; fictional personal broadcasts and 엑셀방송 crews ──
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
    ["a1", "[엑셀방송] 불꽃크루 시즌2 4회차 · 직급전 막판 역전!", "불꽃크루", 3_920, "VARIETY", 1, 1, "SOOP"],
    ["a2", "[엑셀] 별빛크루 댄스 직급전 · 팀 배틀 1부", "별빛크루", 2_870, "MUSIC_DANCE", 6, 2, "FLEXTV"],
    ["a3", "금요일 밤 소통 방송 · 오늘의 사연 읽어요", "하루봄", 2_410, "TALK", 4, 3, "YOUTUBE"],
    ["a4", "신청곡 받아요 · 라이브 노래방", "도도쭈", 1_830, "MUSIC_DANCE", 2, 4, "SOOP"],
    ["a5", "시청자 추천 메뉴로 야식 먹방", "먹깨비소이", 1_540, "MUKBANG", 5, 5, "FLEXTV"],
    ["a6", "다이아 찍을 때까지 랭크 · 시참 환영", "밤톨게임", 1_290, "GAME", 3, 6, "SOOP"],
    ["a7", "[엑셀] 신입 크루 오디션 회차 · 첫 직급 배정", "초록별크루", 1_180, "VARIETY", 1, 7, "YOUTUBE"],
    ["a8", "시참 내전 · 같이 하실 분 들어오세요", "겜돌이준", 1_120, "GAME", 3, 1, "FLEXTV"],
    ["a9", "새벽 라디오 · 잔잔한 사연 토크", "새벽감성", 980, "TALK", 8, 2, "YOUTUBE"],
    ["a10", "주말 드라마 같이보기 소통", "수다봇치", 870, "TALK", 11, 3, "SOOP"],
    ["a11", "강아지 형제랑 산책 다녀왔어요", "댕댕하우스", 760, "DAILY_TRAVEL", 4, 4, "FLEXTV"],
    ["a12", "동네 분식 포장해서 같이 먹어요", "냠냠하루", 690, "MUKBANG", 5, 5, "SOOP"],
    ["a13", "[엑셀] 듀오 한방 후원 데이 · 벌칙 룰렛", "투톤듀오", 650, "VARIETY", 10, 6, "YOUTUBE"],
    ["a14", "토끼 귀 버츄얼의 그림 그리기 방송", "린토끼", 640, "VIRTUAL", 7, 7, "FLEXTV"],
    ["a15", "기타 치면서 수다 · 어쿠스틱 라이브", "어쿠스틱해담", 530, "MUSIC_DANCE", 9, 1, "SOOP"]
  ] satisfies Seed[]
).map(channel);

// Figma 617:5 shows four cards per section; extra cards (revealed by 더보기) reuse the pool above.
const MOCK_POPULAR: PopularLiveSection[] = [
  {
    category: "MUSIC_DANCE",
    title: "추천 음악/댄스 채널",
    channels: (
      [
        ["p1", "[엑셀] 별빛크루 댄스 직급전 · 팀 배틀 1부", "별빛크루", 2_870, "MUSIC_DANCE", 6, 2, "FLEXTV"],
        ["p2", "신청곡 받아요 · 라이브 노래방", "도도쭈", 1_830, "MUSIC_DANCE", 2, 4, "SOOP"],
        ["p3", "기타 치면서 수다 · 어쿠스틱 라이브", "어쿠스틱해담", 530, "MUSIC_DANCE", 9, 1, "SOOP"],
        ["p4", "커버댄스 연습 같이 봐요", "춤추는모모", 410, "MUSIC_DANCE", 10, 6, "YOUTUBE"],
        ["p5", "트로트 신청곡 메들리", "흥부자다온", 360, "MUSIC_DANCE", 2, 3, "FLEXTV"]
      ] satisfies Seed[]
    ).map(channel)
  },
  {
    category: "TALK",
    title: "추천 토크 채널",
    channels: (
      [
        ["p6", "금요일 밤 소통 방송 · 오늘의 사연 읽어요", "하루봄", 2_410, "TALK", 4, 3, "YOUTUBE"],
        ["p7", "새벽 라디오 · 잔잔한 사연 토크", "새벽감성", 980, "TALK", 8, 2, "YOUTUBE"],
        ["p8", "주말 드라마 같이보기 소통", "수다봇치", 870, "TALK", 11, 3, "SOOP"],
        ["p9", "퇴근길 고민 상담 소통", "고민들어줌", 520, "TALK", 8, 7, "SOOP"],
        ["p10", "오늘 뭐 먹지 · 메뉴 투표 수다", "말랑수다", 440, "TALK", 12, 5, "FLEXTV"]
      ] satisfies Seed[]
    ).map(channel)
  },
  {
    category: "VIRTUAL",
    title: "추천 버츄얼 채널",
    channels: (
      [
        ["p11", "토끼 귀 버츄얼의 그림 그리기 방송", "린토끼", 640, "VIRTUAL", 7, 7, "FLEXTV"],
        ["p12", "마이크 바꿨어요 · 노래 테스트", "별사탕루루", 210, "VIRTUAL", 7, 4, "SOOP"],
        ["p13", "생존 게임 첫날 · 같이 버텨요", "고양이나비", 140, "VIRTUAL", 3, 2, "YOUTUBE"],
        ["p14", "저녁 소통 · 오늘의 낙서", "구름비누", 90, "VIRTUAL", 7, 6, "FLEXTV"]
      ] satisfies Seed[]
    ).map(channel)
  }
];
