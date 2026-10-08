import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { Platform } from "@/types/platform";

/**
 * Live channel list contract.
 * Figma: ssumnation-all-live-page 617:316 (전체라이브), ssumnation-popular-live-page 617:5 (인기라이브)
 * Platform DTOs are mapped to these types on the server (PlatformAdapter), never passed through.
 *
 * 2026-10-02 product decision: no topic categories (시사 · 금융 · 음악 …). Live lists are only split into
 * 인기 라이브 (most viewers first) and 전체 라이브. The Figma category chips and sections are not used.
 */

export type LiveChannel = {
  id: string;
  title: string;
  channelName: string;
  channelAvatarUrl: string;
  thumbnailUrl: string;
  viewerCount: number;
  platform: Platform;
  /** Seconds since the broadcast started, computed on the server when the list is fetched. */
  elapsedSeconds: number;
  href: string;
};

/** How many channels 인기 라이브 shows (the rest stay in 전체 라이브). Mock value; ranking rules are TBD. */
export const POPULAR_LIVE_COUNT = 8;

const byViewers = (a: LiveChannel, b: LiveChannel) => b.viewerCount - a.viewerCount;

export async function getAllLiveChannels(): Promise<LiveChannel[]> {
  if (!USE_MOCK) throw new Error("Live channel API is not connected yet.");
  await mockDelay(300);
  return [...MOCK_ALL_LIVE].sort(byViewers);
}

/** 인기 라이브 — the most watched live channels right now. */
export async function getPopularLiveChannels(): Promise<LiveChannel[]> {
  return (await getAllLiveChannels()).slice(0, POPULAR_LIVE_COUNT);
}

// ── Mock data: fictional personal broadcasts and 엑셀방송 crews ─────────────────
// Platforms are spread across the three for filter testing. Live detail routes do not exist yet,
// so every channel links to /live.

const T = (n: number) => `/mock/live/thumb-${n}.jpg`;
const A = (n: number) => `/mock/live/avatar-${n}.png`;
const ELAPSED = 6300; // "01:45:00" in every Figma card

type Seed = [id: string, title: string, channel: string, viewers: number, thumb: number, avatar: number, platform: Platform];

const channel = ([id, title, channelName, viewerCount, thumb, avatar, platform]: Seed): LiveChannel => ({
  id,
  title,
  channelName,
  channelAvatarUrl: A(avatar),
  thumbnailUrl: T(thumb),
  viewerCount,
  platform,
  elapsedSeconds: ELAPSED,
  href: "/live"
});

const MOCK_ALL_LIVE: LiveChannel[] = (
  [
    ["a1", "[엑셀방송] 불꽃크루 시즌2 4회차 · 직급전 막판 역전!", "불꽃크루", 3_920, 1, 1, "SOOP"],
    ["a2", "[엑셀] 별빛크루 댄스 직급전 · 팀 배틀 1부", "별빛크루", 2_870, 6, 2, "FLEXTV"],
    ["a3", "금요일 밤 소통 방송 · 오늘의 사연 읽어요", "하루봄", 2_410, 4, 3, "YOUTUBE"],
    ["a4", "신청곡 받아요 · 라이브 노래방", "도도쭈", 1_830, 2, 4, "SOOP"],
    ["a5", "시청자 추천 메뉴로 야식 먹방", "먹깨비소이", 1_540, 5, 5, "FLEXTV"],
    ["a6", "다이아 찍을 때까지 랭크 · 시참 환영", "밤톨게임", 1_290, 3, 6, "SOOP"],
    ["a7", "[엑셀] 신입 크루 오디션 회차 · 첫 직급 배정", "초록별크루", 1_180, 1, 7, "YOUTUBE"],
    ["a8", "시참 내전 · 같이 하실 분 들어오세요", "겜돌이준", 1_120, 3, 1, "FLEXTV"],
    ["a9", "새벽 라디오 · 잔잔한 사연 토크", "새벽감성", 980, 8, 2, "YOUTUBE"],
    ["a10", "주말 드라마 같이보기 소통", "수다봇치", 870, 11, 3, "SOOP"],
    ["a11", "강아지 형제랑 산책 다녀왔어요", "댕댕하우스", 760, 4, 4, "FLEXTV"],
    ["a12", "동네 분식 포장해서 같이 먹어요", "냠냠하루", 690, 5, 5, "SOOP"],
    ["a13", "[엑셀] 듀오 한방 후원 데이 · 벌칙 룰렛", "투톤듀오", 650, 10, 6, "YOUTUBE"],
    ["a14", "토끼 귀 버츄얼의 그림 그리기 방송", "린토끼", 640, 7, 7, "FLEXTV"],
    ["a15", "기타 치면서 수다 · 어쿠스틱 라이브", "어쿠스틱해담", 530, 9, 1, "SOOP"],
    ["a16", "퇴근길 고민 상담 소통", "고민들어줌", 520, 8, 7, "SOOP"],
    ["a17", "오늘 뭐 먹지 · 메뉴 투표 수다", "말랑수다", 440, 12, 5, "FLEXTV"],
    ["a18", "커버댄스 연습 같이 봐요", "춤추는모모", 410, 10, 6, "YOUTUBE"],
    ["a19", "트로트 신청곡 메들리", "흥부자다온", 360, 2, 3, "FLEXTV"],
    ["a20", "마이크 바꿨어요 · 노래 테스트", "별사탕루루", 210, 7, 4, "SOOP"]
  ] satisfies Seed[]
).map(channel);
