"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { listDonationRecords } from "@/services/wallet/walletHistory";
import { isRankingPeriod, type BoardRow, type CreatorStanding, type MyRankingView, type RankingPeriod } from "./rankingTypes";

/**
 * 내 후원 랭킹 Server Action — code-first (no Figma frame). Route `/mypage/ranking`. The member's
 * totals come from their completed donation records; the rest of the field is a deterministic mock
 * sample. TBD: aggregation rules, ties, season resets, public visibility.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Ranking API is not connected yet.");
};

/** Sample donor pool (placeholder names; lifetime FN). Period totals are fixed fractions of it. */
const POOL: { name: string; fn: number }[] = [
  "별빛후원러", "새벽라디오", "콩트러버", "치즈냥", "게임덕후", "먹방요정", "달빛소나타", "초코파이", "후원장인", "라이브덕",
  "밤하늘", "응원단장님", "노래방왕", "푸른바다", "행복한하루", "팬심가득", "첫눈", "주말방송러", "코코아", "레몬에이드",
  "구름빵", "딸기우유", "파란하늘", "고양이집사", "맑음"
].map((name, i) => ({ name, fn: Math.round(2_400_000 / (1 + i * 0.55)) }));

const SHARE: Record<RankingPeriod, number> = { all: 1, year: 0.62, month: 0.11 };

function periodStart(p: RankingPeriod) {
  const now = new Date();
  if (p === "all") return "";
  const d = p === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getMyRanking(period: unknown): Promise<MyRankingView | null> {
  assertMock();
  const session = await getSession();
  if (!session) return null;
  const p: RankingPeriod = isRankingPeriod(period) ? period : "all";
  await mockDelay(250);

  const since = periodStart(p);
  const mine = listDonationRecords().filter((d) => d.status === "COMPLETED" && (!since || d.donatedAt.slice(0, 10) >= since));
  const myTotalFn = mine.reduce((s, d) => s + d.fnAmount, 0);

  const field = POOL.map((x) => ({ name: x.name, totalFn: Math.round(x.fn * SHARE[p]), me: false }));
  const everyone = myTotalFn > 0 ? [...field, { name: session.nickname, totalFn: myTotalFn, me: true }] : field;
  const sorted = everyone.sort((a, b) => b.totalFn - a.totalFn);
  const ranked: BoardRow[] = sorted.map((r, i) => ({ rank: i + 1, ...r }));
  const meRow = ranked.find((r) => r.me) ?? null;
  const board = ranked.slice(0, 20);
  if (meRow && meRow.rank > 20) board.push(meRow);

  // Per creator: the member vs. a small sample of that creator's other donors.
  const byCreator = new Map<string, { name: string; total: number }>();
  for (const d of mine) {
    const e = byCreator.get(d.creatorId) ?? { name: d.creatorName, total: 0 };
    e.total += d.fnAmount;
    byCreator.set(d.creatorId, e);
  }
  const creators: CreatorStanding[] = [...byCreator.entries()]
    .map(([creatorId, e], idx) => {
      const others = POOL.slice(idx % 5, (idx % 5) + 8).map((x) => Math.round(x.fn * SHARE[p] * 0.05));
      const myRank = 1 + others.filter((v) => v > e.total).length;
      return { creatorId, creatorName: e.name, myTotalFn: e.total, myRank, donors: others.length + 1 };
    })
    .sort((a, b) => b.myTotalFn - a.myTotalFn);

  return {
    period: p,
    myTotalFn,
    myRank: meRow?.rank ?? null,
    totalDonors: everyone.length,
    topPercent: meRow ? Math.max(1, Math.round((meRow.rank / everyone.length) * 100)) : null,
    board,
    creators,
    visible: Object.values(mockAccount.rankingVisibility).some(Boolean)
  };
}
