import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { mockCreator } from "./mockCreatorStore";
import { mockSettlement } from "./mockSettlementStore";
import type { SettlementStatus } from "./settlementTypes";
import type { Platform } from "@/types/platform";
import { eachDay, type StatsPeriod } from "./creatorStats";
import { startOfMonths, startOfWeek } from "@/lib/period";

export * from "./creatorStats";

/**
 * Creator studio reads (Figma "03 Creator Core"): dashboard 245:14 · profile dropdown 758:41.
 * Route `/creator` — signed-in creators only.
 *
 * TBD (backend): who is a creator (role/approval), how a member's creator channel is created, and whether
 * 후원 수익 is gross or net of fees. The design shows revenue in ₩, so the server returns KRW values and the
 * browser only formats them — no FN→KRW conversion happens here.
 */

export type CreatorPlatformLink = { platform: Platform; logoUrl: string; connected: boolean };

export type CreatorProfile = {
  channelName: string;
  handle: string;
  avatarUrl: string | null;
  /** Public donation page for viewers (design shows two URL patterns; the server owns it). */
  donateUrl: string;
  platforms: CreatorPlatformLink[];
};

export type RecentDonation = { id: string; donor: string; amount: number; message: string; createdAt: string };
export type RankEntry = { rank: number; donor: string; amount: number };

export type CreatorDashboard = {
  period: StatsPeriod;
  stats: { count: number; revenue: number; donors: number };
  /** Revenue per bucket (daily, weekly or monthly depending on the period length). */
  series: { label: string; amount: number }[];
  recent: RecentDonation[];
  rankings: Record<"day" | "week" | "month", RankEntry[]>;
  banners: { event: { imageUrl: string; alt: string } | null; ad: { imageUrl: string; alt: string } | null };
};

export async function getCreatorProfile(): Promise<CreatorProfile | null> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  if (!(await getCreatorSession())) return null;
  return {
    channelName: mockCreator.channelName,
    handle: mockCreator.handle,
    // Slot 0 of the creator profile images is the 대표 image; fall back to the member photo.
    avatarUrl: mockCreator.images[0] ?? mockAccount.avatarUrl,
    donateUrl: `https://ssumnation.com/donate/${mockCreator.handle}`,
    // Dropdown 758:41 shows 치지직/Twitch, which are not confirmed platforms; the confirmed ones are used.
    platforms: mockAccount.connectedPlatforms.map((p) => ({ platform: p.platform, logoUrl: LOGOS[p.platform], connected: p.handle !== null }))
  };
}

export async function getCreatorDashboard(period: StatsPeriod): Promise<CreatorDashboard | null> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  if (!(await getCreatorSession())) return null;
  await mockDelay(300);

  const days = eachDay(period.from, period.to);
  const daily = days.map((d) => ({ date: d, amount: mockDailyRevenue(d) }));
  const revenue = daily.reduce((sum, d) => sum + d.amount, 0);
  return {
    period,
    stats: { count: Math.round(revenue / 19_140), revenue, donors: Math.round(revenue / 27_530) },
    series: bucket(daily),
    recent: RECENT.map((r, i) => ({ ...r, id: `r${i + 1}`, createdAt: new Date(Date.now() - r.minutesAgo * 60_000).toISOString() })),
    rankings: RANKINGS,
    banners: {
      event: { imageUrl: "/mock/creator/banner-event.png", alt: "크루 후원 신규 기능 출시" },
      ad: { imageUrl: "/mock/creator/banner-ad.png", alt: "크리애드 광고" }
    }
  };
}

/** ≤31 days → daily, ≤180 → weekly, otherwise monthly. */
function bucket(daily: { date: string; amount: number }[]) {
  const label = (iso: string, mode: "day" | "month") => (mode === "day" ? `${iso.slice(5, 7)}.${iso.slice(8, 10)}` : `${iso.slice(2, 4)}.${iso.slice(5, 7)}`);
  if (daily.length <= 31) return daily.map((d) => ({ label: label(d.date, "day"), amount: d.amount }));
  if (daily.length <= 180) {
    const weeks: { label: string; amount: number }[] = [];
    daily.forEach((d, i) => {
      if (i % 7 === 0) weeks.push({ label: label(d.date, "day"), amount: 0 });
      weeks[weeks.length - 1].amount += d.amount;
    });
    return weeks;
  }
  const months = new Map<string, number>();
  daily.forEach((d) => months.set(label(d.date, "month"), (months.get(label(d.date, "month")) ?? 0) + d.amount));
  return [...months].map(([l, amount]) => ({ label: l, amount }));
}

// ── Mock data: Figma 245:14 ──────────────────────────────────────────────────

const LOGOS: Record<Platform, string> = {
  YOUTUBE: "/mock/room/logo-youtube.png",
  SOOP: "/mock/room/logo-soop.png",
  FLEXTV: "/mock/room/logo-flextv.png",
  CHZZK: "/mock/room/logo-chzzk.svg"
};

/** Figma chart 01.01–01.07 (₩28만 … ₩35만), repeated by weekday so any range has plausible data. */
const WEEK_PATTERN = [280_000, 450_000, 320_000, 520_000, 180_000, 350_000, 350_000];

function mockDailyRevenue(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return WEEK_PATTERN[(d.getDay() + 6) % 7];
}

const RECENT = [
  { donor: "민지대마왕", amount: 50_000, message: "오늘 방송 너무 재밌어요! 화이팅!", minutesAgo: 10 },
  { donor: "겜돌이철수", amount: 100_000, message: "리액션 혜자네요ㅋㅋ 맛있는거 드세요!", minutesAgo: 32 },
  { donor: "서연_Lofi", amount: 10_000, message: "항상 응원합니다 화이팅", minutesAgo: 60 },
  { donor: "코드파이터", amount: 30_000, message: "신작 게임 분석 최고였습니다.", minutesAgo: 180 },
  { donor: "럭키짱", amount: 1_000, message: "재밌는 콘텐츠에 무릎을 탁..", minutesAgo: 300 },
  { donor: "초보러너", amount: 5_000, message: "소소하게 후원하고 갑니다~", minutesAgo: 310 }
];

const WEEK_RANKING: RankEntry[] = [
  { rank: 1, donor: "민지대마왕", amount: 150_000 },
  { rank: 2, donor: "겜돌이철수", amount: 100_000 },
  { rank: 3, donor: "서연_Lofi", amount: 50_000 },
  { rank: 4, donor: "코드파이터", amount: 30_000 },
  { rank: 5, donor: "초보러너", amount: 5_000 }
];

const RANKINGS: CreatorDashboard["rankings"] = {
  day: [
    { rank: 1, donor: "겜돌이철수", amount: 100_000 },
    { rank: 2, donor: "민지대마왕", amount: 50_000 },
    { rank: 3, donor: "코드파이터", amount: 30_000 },
    { rank: 4, donor: "서연_Lofi", amount: 10_000 },
    { rank: 5, donor: "초보러너", amount: 5_000 }
  ],
  week: WEEK_RANKING,
  month: [
    { rank: 1, donor: "민지대마왕", amount: 620_000 },
    { rank: 2, donor: "겜돌이철수", amount: 480_000 },
    { rank: 3, donor: "코드파이터", amount: 210_000 },
    { rank: 4, donor: "서연_Lofi", amount: 150_000 },
    { rank: 5, donor: "초보러너", amount: 45_000 }
  ]
};

// ── 대시보드 요약 카드 (funnation structure, code-first) ───────────────────────

export type DashboardSummary = {
  /** 받은 후원 in ₩ (same source and unit as the stats above). */
  received: { today: Tally; week: Tally; month: Tally; total: Tally };
  /** 정산 in FN (settlement records). 누적 수익 = 정산 가능 + 요청 중 + 승인(지급); 누적 출금 = 승인된 정산. */
  settlement: { availableFn: number; earnedFn: number; withdrawnFn: number };
  /** This month's top supporters. */
  topDonors: RankEntry[];
};
type Tally = { amount: number; count: number };

/**
 * funnation 대시보드 cards: 받은 후원 (오늘 · 이번 주 · 이번 달 · 누적), 정산 (정산 가능 · 누적 수익 ·
 * 누적 출금) and 후원자 순위. Everything is computed on the server from the mock records. 이번 주 starts on Monday
 * 00:00 and 이번 달 on the 1st, as in the 후원 리스트 summary (2026-10-08 결정 "달력 기준").
 */
export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  if (!(await getCreatorSession())) return null;
  await mockDelay(150);
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tally = (from: string): Tally => {
    const amount = sumRevenue(from, iso(today));
    return { amount, count: Math.round(amount / 19_140) };
  };
  const sum = (...statuses: SettlementStatus[]) => mockSettlement.requests.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r.amountFn, 0);
  // 승인 and 지급 완료 both count as 출금, as 승인 did before the 지급 완료 step (2026-10-08) existed.
  const paid = sum("APPROVED", "PAID");
  const pending = sum("PENDING");
  return {
    received: { today: tally(iso(today)), week: tally(iso(startOfWeek(today))), month: tally(iso(startOfMonths(1, today))), total: tally(MOCK_REVENUE_START) },
    settlement: { availableFn: mockSettlement.availableFn, earnedFn: mockSettlement.availableFn + pending + paid, withdrawnFn: paid },
    topDonors: RANKINGS.month.slice(0, 5)
  };
}

/**
 * First day of the mock revenue records: 누적 sums every record from here. Fixed — it never follows the editable 데뷔일
 * (a 데뷔일 of today made 누적 smaller than 이번 주, and a very old one made every request loop over centuries).
 */
const MOCK_REVENUE_START = "2020-03-15";

/** Mock revenue over any range (eachDay is capped at MAX_RANGE_DAYS for the stats filter). */
function sumRevenue(from: string, to: string) {
  let total = 0;
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (; d <= end; d.setDate(d.getDate() + 1)) total += mockDailyRevenue(isoDay(d));
  return total;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ── 수익 현황 (funnation 수익 대시보드, code-first) ──────────────────────────────

export type RevenueOverview = {
  /** ₩, same source as the dashboard stats. */
  totalRevenue: number;
  today: { amount: number; count: number };
  thisMonth: number;
  /** 미정산 = settlement 정산 가능 (FN). */
  unsettledFn: number;
  /** Last 30 days, oldest first. */
  daily: { label: string; amount: number }[];
  /** Last 6 months incl. this one, oldest first. */
  monthly: { label: string; amount: number }[];
  topDonors: RankEntry[];
  /** 수익원별 상세 for 이번 달 (₩): by donation type and by route, each summing to `thisMonth`, largest first. */
  bySource: { types: RevenueShare[]; routes: RevenueShare[] };
};

export type RevenueShare = { key: string; label: string; amount: number };

/** Splits `total` by integer weights so the parts add up exactly (the remainder goes to the largest part). */
export function splitByWeight(total: number, weights: { key: string; label: string; weight: number }[]): RevenueShare[] {
  const sum = weights.reduce((s, w) => s + w.weight, 0);
  const parts = weights.map((w) => ({ key: w.key, label: w.label, amount: sum ? Math.floor((total * w.weight) / sum) : 0 }));
  parts.sort((a, b) => b.amount - a.amount);
  if (parts.length) parts[0].amount += total - parts.reduce((s, p) => s + p.amount, 0);
  return parts;
}

// 수익원별 상세 (funnation 참고, 2026-10-06 결정). The mock has one daily revenue series, so it splits the month by
// fixed weights; the real backend sums completed donations by type and by route.
const MOCK_TYPE_WEIGHTS = [
  { key: "TEXT", label: "일반 후원", weight: 38 },
  { key: "SIGNATURE", label: "시그니처 후원", weight: 22 },
  { key: "MINI", label: "미니 후원", weight: 9 },
  { key: "VIDEO", label: "영상 후원", weight: 8 },
  { key: "QUEST", label: "퀘스트 후원", weight: 7 },
  { key: "ROULETTE", label: "룰렛 후원", weight: 5 },
  { key: "GACHA", label: "뽑기 후원", weight: 4 },
  { key: "WISHLIST", label: "위시 후원", weight: 4 },
  { key: "DRAWING", label: "그림 후원", weight: 3 }
];
const MOCK_ROUTE_WEIGHTS = [
  { key: "DIRECT", label: "방송 방 (직접 후원)", weight: 70 },
  { key: "SOOP", label: "SOOP 플랫폼 후원", weight: 20 },
  { key: "FLEXTV", label: "FlexTV 플랫폼 후원", weight: 10 }
];

/**
 * 수익 현황 (route `/creator/revenue`): totals, 30-day daily and 6-month monthly trends, top supporters.
 * Computed on the server from the mock records. 수익원별 상세 is a mock split (see MOCK_TYPE_WEIGHTS). TBD: store
 * (상품) revenue, gross vs net of fees.
 */
export async function getRevenueOverview(): Promise<RevenueOverview | null> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  if (!(await getCreatorSession())) return null;
  await mockDelay(200);
  const now = new Date();
  const today = isoDay(now);
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29 + i);
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, amount: mockDailyRevenue(isoDay(d)) };
  });
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const first = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const last = i === 5 ? now : new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return { label: `${first.getMonth() + 1}월`, amount: sumRevenue(isoDay(first), isoDay(last)) };
  });
  const todayAmount = mockDailyRevenue(today);
  return {
    totalRevenue: sumRevenue(MOCK_REVENUE_START, today),
    today: { amount: todayAmount, count: Math.round(todayAmount / 19_140) },
    thisMonth: monthly[5].amount,
    unsettledFn: mockSettlement.availableFn,
    daily,
    monthly,
    topDonors: RANKINGS.month.slice(0, 5),
    bySource: { types: splitByWeight(monthly[5].amount, MOCK_TYPE_WEIGHTS), routes: splitByWeight(monthly[5].amount, MOCK_ROUTE_WEIGHTS) }
  };
}
