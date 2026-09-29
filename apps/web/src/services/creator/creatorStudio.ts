import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import type { Platform } from "@/types/platform";
import { eachDay, type StatsPeriod } from "./creatorStats";

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
  if (!(await getSession())) return null;
  return {
    channelName: `${mockAccount.nickname}의 방송`,
    handle: "honggildong",
    avatarUrl: mockAccount.avatarUrl,
    donateUrl: "https://funation.com/donate/honggildong",
    // Dropdown 758:41 shows 치지직/Twitch, which are not confirmed platforms; the confirmed ones are used.
    platforms: mockAccount.connectedPlatforms.map((p) => ({ platform: p.platform, logoUrl: LOGOS[p.platform], connected: p.handle !== null }))
  };
}

export async function getCreatorDashboard(period: StatsPeriod): Promise<CreatorDashboard | null> {
  if (!USE_MOCK) throw new Error("Creator API is not connected yet.");
  if (!(await getSession())) return null;
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
  FLEXTV: "/mock/room/logo-flextv.png"
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
