import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { mockCreator } from "./mockCreatorStore";

/**
 * Creator ranking — Figma 405:4 (퀘스트) · 405:302 (럭키박스) · 405:598 (플레이). Route `/creator/ranking`.
 * Ranks creators (not supporters) per donation feature. Server-side read; the browser only renders.
 *
 * TBD (backend/product): how 랭킹 포인트 is scored, what counts as a quest 성공 / luckybox 당첨,
 * season length and reset, the baseline for 변동, the tie rule, rewards for the top 3 and when a
 * creator's name is masked ("*****").
 */

export type RankingType = "quest" | "luckybox" | "play";
export type RankingPeriod = "day" | "week" | "month" | "season";

export const RANKING_TYPES: { key: RankingType; tab: string; myLabel: string; countLabel: string; rateLabel: string }[] = [
  { key: "quest", tab: "퀘스트 랭킹", myLabel: "나의 퀘스트 랭킹", countLabel: "성공 횟수", rateLabel: "성공률" },
  { key: "luckybox", tab: "럭키박스 랭킹", myLabel: "내 럭키박스 랭킹", countLabel: "당첨 횟수", rateLabel: "승률" },
  { key: "play", tab: "플레이 랭킹", myLabel: "내 플레이 랭킹", countLabel: "성공 횟수", rateLabel: "성공률" }
];

export const RANKING_PERIODS: { key: RankingPeriod; label: string }[] = [
  { key: "day", label: "일간" },
  { key: "week", label: "주간" },
  { key: "month", label: "월간" },
  { key: "season", label: "시즌" }
];

/** Design default: 시즌. */
export const DEFAULT_RANKING_PERIOD: RankingPeriod = "season";
export const RANKING_PAGE_SIZE = 30;
export const RANKING_QUERY_MAX = 20;

export type RankingRow = {
  rank: number;
  /** Positive = moved up, negative = moved down, 0 = unchanged. */
  change: number;
  /** `null` when the creator's name is masked. */
  name: string | null;
  avatarUrl: string | null;
  points: number;
  count: number;
  /** Whole percent 0–100. */
  rate: number;
};

export type MyRanking = {
  name: string;
  handle: string;
  avatarUrl: string | null;
  /** `null` = not ranked in this period ("-위"). */
  rank: number | null;
  change: number | null;
  points: number;
  count: number;
  rate: number;
};

export type CreatorRanking = {
  type: RankingType;
  period: RankingPeriod;
  query: string;
  page: number;
  totalPages: number;
  total: number;
  rows: RankingRow[];
  me: MyRanking;
};

export const parseRankingType = (v: string | undefined): RankingType =>
  RANKING_TYPES.some((t) => t.key === v) ? (v as RankingType) : "quest";
export const parseRankingPeriod = (v: string | undefined): RankingPeriod =>
  RANKING_PERIODS.some((p) => p.key === v) ? (v as RankingPeriod) : DEFAULT_RANKING_PERIOD;

export async function getCreatorRanking(input: { type: RankingType; period: RankingPeriod; query?: string; page?: number }): Promise<CreatorRanking | null> {
  if (!USE_MOCK) throw new Error("Creator ranking API is not connected yet.");
  if (!(await getCreatorSession())) return null;
  await mockDelay(300);

  const query = (input.query ?? "").trim().slice(0, RANKING_QUERY_MAX);
  const all = mockRows(input.type, input.period);
  // Masked creators are not searchable by name.
  const needle = query.toLowerCase();
  const matched = needle ? all.filter((r) => r.name !== null && r.name.toLowerCase().includes(needle)) : all;
  const totalPages = Math.max(1, Math.ceil(matched.length / RANKING_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(input.page ?? 1) || 1), totalPages);

  return {
    type: input.type,
    period: input.period,
    query,
    page,
    totalPages,
    total: matched.length,
    rows: matched.slice((page - 1) * RANKING_PAGE_SIZE, page * RANKING_PAGE_SIZE),
    // The mock creator has no ranked activity yet — the design's own state ("-위", 0, 0회, 0%).
    me: {
      name: mockCreator.channelName,
      handle: mockCreator.handle,
      avatarUrl: mockCreator.images[0] ?? mockAccount.avatarUrl,
      rank: null,
      change: null,
      points: 0,
      count: 0,
      rate: 0
    }
  };
}

// ── Mock data ────────────────────────────────────────────────────────────────
// Season values are the design's sample rows. Other periods scale them (mock only). A few design rows
// had missing/odd 변동 values; they are normalised here.

type Seed = [change: number, name: string | null, points: number, count: number, rate: number];

const QUEST: Seed[] = [
  [1, null, 76411, 655, 99], [367, "무스", 60463, 1487, 79], [-2, "감제이", 57608, 1458, 96], [3, "쪼냐 JJONAK", 50086, 551, 74],
  [10, null, 43165, 616, 89], [0, "로브", 40727, 508, 68], [-3, "이중선", 38194, 1029, 97], [0, "12시10분엔터테인먼트", 30437, 639, 97],
  [41, null, 28647, 1641, 100], [0, "안내메시지", 27731, 230, 72], [-6, null, 27273, 793, 89], [-1, "하얀 ·", 22534, 299, 96],
  [-1, "나무늘보", 22044, 670, 67], [5, "불가지", 21938, 570, 83], [11, null, 20616, 434, 96], [1784, "구카노", 20120, 385, 79],
  [20, "량이아 Ryangiya", 16888, 824, 96], [-2, "우기잉", 15136, 254, 74], [0, "Phantom Hearts(팬텀하츠)", 14929, 286, 98],
  [41, null, 13678, 363, 88], [48, "에이스에이스", 12639, 153, 100], [0, "빅도지", 12341, 448, 96], [-2, "종대__", 12078, 250, 93],
  [-2, "김노아", 12038, 96, 95], [153, "철권소담", 11535, 414, 95], [-17, "즐겟맨", 11433, 383, 93], [0, "슈비", 11421, 342, 78],
  [287, "삼국전기1", 11373, 161, 67], [-26, null, 10952, 212, 73], [6, "젠니__", 10837, 61, 55]
];

const LUCKYBOX: Seed[] = [
  [63, "구카노", 40626, 442, 66], [68, "허동동", 20893, 75, 32], [730, "아가왕승아비", 15436, 119, 40], [89, "우정우정우정우정", 14584, 78, 39],
  [0, "킨스맨테이블 성준", 13867, 41, 44], [2, "한두자나S2", 10788, 113, 43], [983, "보해리움 Boharium", 10051, 174, 35],
  [0, null, 9626, 27, 47], [0, "용근제", 9186, 29, 37], [-1, "차지옹", 9023, 375, 55], [0, "[YM상시]홍연달련♥", 8578, 32, 43],
  [15, "경로제 DDOBAE", 8390, 28, 40], [17, "승냥이1", 8212, 83, 43], [370, "위너비ASMR", 7751, 58, 76], [0, "킨스맨테이블 견라벼", 7690, 147, 43],
  [579, "달려라나", 7423, 166, 45], [0, "경세령", 7090, 35, 49], [233, "오랑이언니-[orang]", 7083, 61, 49], [0, "또구미", 6932, 50, 49],
  [4, "별주부TV", 6788, 148, 42], [0, "킨스맨테이블 치유현", 5569, 44, 42], [93, "젠니__", 5521, 32, 37], [0, "가액진", 5458, 40, 38],
  [-11, "에런디라", 5361, 69, 39], [73, "자니주디", 5070, 210, 42], [0, "[YM상시]조유정", 5000, 12, 21], [46, "부산이형타조[Tajo]", 4780, 30, 38],
  [0, "세란이[SERAN]", 4627, 20, 61], [-14, "쉐다로", 4604, 76, 62], [0, "포커", 4507, 190, 48]
];

const PLAY: Seed[] = [
  [1016, "보해리움 Boharium", 19742, 954, 48], [0, "세란이(SERAN)", 12632, 49, 56], [134, "승냥이1", 5845, 147, 47], [0, "개그우현양기버", 5019, 116, 31],
  [0, "째이", 4677, 32, 19], [3, "스맨혜우경", 4497, 112, 49], [0, "이쁜디티비", 4012, 144, 57], [2, "뱅대기", 3974, 52, 18],
  [0, "엄감 (Mothers are strong)", 3401, 135, 52], [0, "나현닝이티", 3258, 48, 48], [-6, "DanielYoung(다니엘영)", 3075, 194, 69],
  [128, "앙팡앙", 3036, 68, 53], [99, "종아니 (INA)", 2825, 35, 29], [0, "라유횽이라그불러주세요_", 2640, 10, 63],
  [662, "스트리머 사토 live-streamer sait o", 2531, 119, 39], [35, "따니클락", 2527, 31, 65], [-14, "별주부TV", 2411, 145, 64],
  [0, "또구미", 2134, 84, 30], [0, "퓨노어", 1957, 61, 34], [10, "타호", 1880, 132, 49], [-14, "우기잉", 1791, 13, 81], [100, "복너", 1699, 56, 25],
  [12, "노래하느코트", 1645, 67, 43], [58, "연락주세용", 1634, 103, 32], [549, null, 1575, 17, 40], [0, "김라라", 1533, 33, 37],
  [-26, "한두자나S2", 1473, 48, 54], [85, "조각난벽돌", 1413, 18, 67], [-19, "놀고먹는 떡칙떡", 1386, 119, 41], [0, "유유youwe", 1386, 94, 54]
];

const SEEDS: Record<RankingType, Seed[]> = { quest: QUEST, luckybox: LUCKYBOX, play: PLAY };
const PERIOD_SCALE: Record<RankingPeriod, number> = { day: 0.03, week: 0.15, month: 0.45, season: 1 };
const EXTRA_NAMES = ["달빛소나타", "게임하는곰", "노을TV", "코코넛", "하루한판", "별빛라디오", "치즈냥", "밤샘러", "퀘스트장인", "럭키가이"];
const AVATARS = Array.from({ length: 10 }, (_, i) => `/mock/creators/creator-${i + 1}.png`);

function mockRows(type: RankingType, period: RankingPeriod): RankingRow[] {
  const scale = PERIOD_SCALE[period];
  const seeds = SEEDS[type];
  const last = seeds[seeds.length - 1][2];
  // 60 extra rows below the design's 30 so pagination has something to page through.
  const extra: Seed[] = Array.from({ length: 60 }, (_, i) => [
    ((i * 7) % 5) - 2,
    `${EXTRA_NAMES[i % EXTRA_NAMES.length]}${Math.floor(i / EXTRA_NAMES.length) + 1}`,
    Math.max(1, Math.round(last * (1 - (i + 1) / 64))),
    20 + ((i * 13) % 90),
    30 + ((i * 17) % 60)
  ]);
  const rows = [...seeds, ...extra].map(([change, name, points, count, rate], i) => ({
    change: scale === 1 ? change : Math.trunc(change / 3),
    name,
    avatarUrl: name !== null && i < 14 ? AVATARS[i % AVATARS.length] : null,
    points: Math.round(points * scale),
    count: Math.max(0, Math.round(count * scale)),
    rate
  }));
  rows.sort((a, b) => b.points - a.points);
  // Competition ranking (equal points share a rank, as in the design's two 29위 rows). Tie rule TBD.
  return rows.map((r) => ({ ...r, rank: rows.findIndex((x) => x.points === r.points) + 1 }));
}
