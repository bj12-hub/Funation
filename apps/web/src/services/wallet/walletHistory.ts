import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { accountAt, accountSince } from "@/services/account/withdrawalCore";
import { findQuest } from "@/services/donations/questCore";
import { drawState } from "@/services/donations/gachaCore";
import { spinState } from "@/services/donations/rouletteCore";
import { isBlankPrize } from "@/services/donations/rouletteTypes";
import { currentAccountCredits } from "./mockCreditStore";
import { mockRefunds, refundView } from "./mockRefundStore";
import { mockWallet } from "./mockWalletStore";
import { toDateString, type Period } from "@/lib/period";
import {
  CHARGE_STATUS_LABEL,
  DONATION_STATUS_LABEL,
  LEDGER_PERIODS,
  type ChargeRecord,
  type ChargeStatus,
  type DonationCategory,
  type DonationFilter,
  type DonationRecord,
  type DonationStatus,
  type HistoryPage,
  type LedgerEntry,
  type LedgerPeriod,
  type WalletOverview,
  type WalletSummary
} from "./walletTypes";

export * from "./walletTypes";

/**
 * FN wallet history (read-only).
 * Figma: 충전내역 640:2 (empty 639:2, detail 643:4 · 644:6 · 644:185 · 644:364),
 *        후원내역 632:4 (empty 637:214). Routes `/wallet/charges`, `/wallet/donations`.
 *
 * Every amount and status here comes from the server. The browser never derives balances,
 * KRW amounts or statuses (docs/domains/wallet.md, payment.md). Reads return `null` without a session.
 */

const PAGE_SIZE = 10;

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getWalletSummary(): Promise<WalletSummary | null> {
  if (!USE_MOCK) throw new Error("Wallet API is not connected yet.");
  if (!(await getSession())) return null;
  return { balance: mockAccount.fnBalance, available: mockAccount.fnBalance, expiring: 0 };
}

export async function getChargeHistory(input: { period: Period; page?: number; all?: boolean }): Promise<HistoryPage<ChargeRecord> | null> {
  if (!USE_MOCK) throw new Error("Wallet API is not connected yet.");
  if (!(await getSession())) return null;
  await mockDelay(300);
  return paginate(
    mockCharges().filter((c) => inPeriod(c.chargedAt, input.period)),
    input
  );
}

/**
 * FN 후원내역 (Figma 632:4) + funnation-style filters: search (크리에이터명 · 메시지), min / max FN,
 * 최신순 / 오래된순, and the filtered total ("결과 N건 · 합계 N FN"). All filtering is server-side.
 */
export async function getDonationHistory(input: {
  period: Period;
  category: DonationCategory;
  page?: number;
  all?: boolean;
  filter?: DonationFilter;
}): Promise<(HistoryPage<DonationRecord> & { totalFn: number }) | null> {
  if (!USE_MOCK) throw new Error("Wallet API is not connected yet.");
  const session = await getSession();
  if (!session) return null;
  await mockDelay(300);
  const f = input.filter ?? {};
  const q = f.q?.trim().toLowerCase() ?? "";
  const rows = mockDonations()
    .filter(
      (d) =>
        d.category === input.category &&
        inPeriod(d.donatedAt, input.period) &&
        (!q || d.creatorName.toLowerCase().includes(q) || d.message.toLowerCase().includes(q)) &&
        (f.min === undefined || d.fnAmount >= f.min) &&
        (f.max === undefined || d.fnAmount <= f.max)
    )
    .sort((a, b) => (f.sort === "oldest" ? a.donatedAt.localeCompare(b.donatedAt) : b.donatedAt.localeCompare(a.donatedAt)));
  const page = paginate(rows, input);
  // 퀘스트 후원: the quest's result; the member who sent it can always decide while it runs.
  // 룰렛 · 뽑기: where the spin/draw is, or its result once the broadcast revealed it.
  const items = page.items.map((d) => {
    const q = d.category === "quest" ? findQuest(d.id) : null;
    if (q) return { ...d, quest: { status: q.status, canDecide: q.status === "IN_PROGRESS" && q.supporterUserId === session.userId } };
    const gameResult = d.category === "game" ? gameResultOf(d.id) : null;
    return gameResult ? { ...d, gameResult } : d;
  });
  return { ...page, items, totalFn: rows.reduce((s, d) => s + d.fnAmount, 0) };
}

function gameResultOf(id: string): string | null {
  const spin = spinState(id);
  if (spin) {
    if (spin.result !== null) return isBlankPrize(spin.result) ? "룰렛 결과 · 꽝" : `룰렛 결과 · ${spin.result} 당첨`;
    return spin.status === "QUEUED" ? "룰렛 대기 중" : spin.status === "WAITING" ? "룰렛 결과 대기" : "룰렛 회전 중";
  }
  const draw = drawState(id);
  if (draw) {
    if (draw.prize !== null) return draw.blank ? "뽑기 결과 · 꽝" : `뽑기 결과 · ${draw.prize} 당첨`;
    return draw.status === "QUEUED" ? "뽑기 실행 대기" : "뽑는 중";
  }
  return null;
}

/**
 * FN Wallet (Figma 817:7552): summary + one 충전·사용·환불 list built from the charge and donation
 * records on the server. A running balance column is not shown — the mock history is not a
 * reconciled ledger; the backend ledger must provide balance-after values (TBD).
 * An approved charge refund shows like a refunded donation: the charge row turns 환불완료 and a
 * separate 환불 row records the FN taken back (−), so `?kind=REFUND` lists it too.
 */
export async function getWalletOverview(input: { kind?: unknown; period?: unknown; page?: unknown }): Promise<WalletOverview | null> {
  if (!USE_MOCK) throw new Error("Wallet API is not connected yet.");
  if (!(await getSession())) return null;
  const kind = input.kind === "CHARGE" || input.kind === "USE" || input.kind === "REFUND" || input.kind === "REWARD" ? input.kind : "all";
  const period: LedgerPeriod = LEDGER_PERIODS.some((p) => p.key === input.period) ? (input.period as LedgerPeriod) : "30";
  await mockDelay(300);

  const donations = mockDonations();
  const charges = mockCharges();
  const debits = new Map(mockRefunds.requests.flatMap((r) => (r.debit ? [[r.chargeId, r.debit] as const] : [])));
  const entries: LedgerEntry[] = [
    ...charges.map(
      (c): LedgerEntry => ({
        id: c.id,
        kind: "CHARGE",
        description: `FN 충전 · ${c.methodLabel}`,
        deltaFn: c.fnAmount,
        statusLabel: debits.has(c.id) ? DONATION_STATUS_LABEL.REFUNDED : CHARGE_STATUS_LABEL[c.status],
        tone: debits.has(c.id) ? "refund" : c.status === "COMPLETED" ? "done" : c.status === "PROCESSING" ? "pending" : "failed",
        at: c.chargedAt.slice(0, 16)
      })
    ),
    ...charges.flatMap((c): LedgerEntry[] => {
      const debit = debits.get(c.id);
      return debit
        ? [{ id: `${c.id}-refund`, kind: "REFUND", description: `충전 환불 · ${c.methodLabel}`, deltaFn: -debit.fnAmount, statusLabel: DONATION_STATUS_LABEL.REFUNDED, tone: "refund", at: debit.at.slice(0, 16) }]
        : [];
    }),
    ...donations.map(
      (d): LedgerEntry => ({
        id: d.id,
        kind: "USE",
        description: `${d.typeLabel} · ${d.creatorName}`,
        deltaFn: -d.fnAmount,
        statusLabel: DONATION_STATUS_LABEL[d.status],
        tone: d.status === "COMPLETED" ? "done" : d.status === "FAILED" ? "failed" : d.status === "REFUNDED" || d.status === "REFUNDING" ? "refund" : "pending",
        at: d.donatedAt.slice(0, 16)
      })
    ),
    ...donations
      .filter((d) => d.status === "REFUNDED")
      .map(
        (d): LedgerEntry => ({
          id: `${d.id}-refund`,
          kind: "REFUND",
          description: `환불 · ${d.typeLabel}`,
          deltaFn: d.fnAmount,
          statusLabel: DONATION_STATUS_LABEL.REFUNDED,
          tone: "refund",
          at: (d.refundedAt ?? d.donatedAt).slice(0, 16)
        })
      ),
    // Matched by the account marker, not by time: a credit from the same minute as a 재가입 is not the new account's.
    ...currentAccountCredits().map(
      (c): LedgerEntry => ({ id: c.id, kind: "REWARD", description: c.reason, deltaFn: c.fnAmount, statusLabel: "완료", tone: "done", at: c.at.slice(0, 16) })
    )
  ].sort((a, b) => b.at.localeCompare(a.at));

  const since = period === "all" ? "" : toDateString(new Date(Date.now() - Number(period) * 86_400_000));
  const filtered = entries.filter((e) => (kind === "all" || e.kind === kind) && (!since || e.at.slice(0, 10) >= since));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const n = Number(input.page);
  const page = Number.isInteger(n) && n >= 1 && n <= totalPages ? n : 1;

  return {
    available: mockAccount.fnBalance,
    locked: 0,
    totalUsed: donations.filter((d) => d.status === "COMPLETED").reduce((sum, d) => sum + d.fnAmount, 0),
    kind,
    period,
    entries: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    page,
    totalPages
  };
}

function inPeriod(timestamp: string, period: Period) {
  const day = timestamp.slice(0, 10);
  return day >= period.from && day <= period.to;
}

function paginate<T>(rows: T[], { period, page = 1, all = false }: { period: Period; page?: number; all?: boolean }): HistoryPage<T> {
  if (all) return { items: rows, totalCount: rows.length, page: 1, totalPages: 1, period };
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), totalCount: rows.length, page: current, totalPages, period };
}

// ── Mock data ────────────────────────────────────────────────────────────────
// Rows follow Figma 640:2 / 643:4 / 632:4, re-dated relative to today so the default 월별 view has data.
// KRW amounts copy the Figma samples (e.g. 10,000 FN → 11,000원); the real FN/KRW rate is TBD.

function stamp(daysAgo: number, time: string) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${toDateString(d)} ${time}`;
}

type MethodKey = "CARD" | "CHECK" | "KAKAO" | "NAVER" | "TOSS" | "BANK" | "DEPOSIT";

const METHODS: Record<MethodKey, { emoji: string; label: string; detail: string | null }> = {
  CARD: { emoji: "💳", label: "신용카드", detail: "일시불" },
  CHECK: { emoji: "💳", label: "체크카드", detail: null },
  KAKAO: { emoji: "📱", label: "카카오페이", detail: null },
  NAVER: { emoji: "📱", label: "네이버페이", detail: null },
  TOSS: { emoji: "📱", label: "토스페이", detail: null },
  BANK: { emoji: "🏦", label: "실시간 계좌이체", detail: null },
  DEPOSIT: { emoji: "🏦", label: "무통장입금", detail: null }
};

const CHARGE_ROWS: [number, string, MethodKey, number, ChargeStatus][] = [
  [1, "14:23:05", "CARD", 10_000, "PROCESSING"],
  [4, "09:11:42", "KAKAO", 30_000, "COMPLETED"],
  [7, "20:47:18", "DEPOSIT", 50_000, "COMPLETED"],
  [9, "16:05:33", "CHECK", 5_000, "COMPLETED"],
  [11, "11:33:57", "NAVER", 100_000, "COMPLETED"],
  [14, "23:58:01", "CARD", 20_000, "CANCELLED"],
  [17, "08:14:29", "TOSS", 3_000, "COMPLETED"],
  [20, "17:42:11", "BANK", 70_000, "COMPLETED"],
  [24, "13:07:44", "KAKAO", 15_000, "COMPLETED"],
  [28, "00:02:59", "CARD", 200_000, "COMPLETED"],
  [29, "19:20:10", "NAVER", 5_000, "COMPLETED"],
  [45, "12:00:41", "CARD", 30_000, "COMPLETED"],
  [61, "21:15:09", "KAKAO", 10_000, "COMPLETED"],
  [88, "10:45:30", "TOSS", 50_000, "CANCELLED"],
  [120, "18:30:02", "CARD", 30_000, "COMPLETED"],
  [180, "09:09:09", "BANK", 100_000, "COMPLETED"],
  [240, "22:40:51", "NAVER", 5_000, "COMPLETED"],
  [330, "15:12:37", "KAKAO", 20_000, "COMPLETED"]
];

/** Each charge with the member-facing view of its refund request. */
function withRefunds<T extends ChargeRecord>(charges: T[]): T[] {
  const refunds = new Map(mockRefunds.requests.map((r) => [r.chargeId, r]));
  return charges.map((c) => {
    const r = refunds.get(c.id);
    return r ? { ...c, refund: refundView(r) } : c;
  });
}

function mockCharges(): ChargeRecord[] {
  // After a 재가입 the sample (seed) history belongs to the withdrawn account; only the new account's charges remain.
  const since = accountSince();
  return withRefunds(since ? mockWallet.charges.filter((c) => c.chargedAt >= since) : [...mockWallet.charges, ...seedCharges()]);
}

/** All charge records of the signed-in mock member (server-side; used by refund requests). */
export function listChargeRecords(): ChargeRecord[] {
  return mockCharges();
}

/**
 * Charges of every account the slot has had, withdrawn ones too, each with the start marker of the account it belongs to
 * (`account`; seed rows: the first account's). Server-side, for the admin console's audit trail — a member only ever
 * sees their own account's (`listChargeRecords`).
 */
export function listAccountChargeRecords(): (ChargeRecord & { account: string | null })[] {
  return withRefunds([...mockWallet.charges.map((c) => ({ ...c, account: accountAt(c.chargedAt) })), ...seedCharges().map((c) => ({ ...c, account: null }))]);
}

/** A charge of any account, also one that withdrew (server-side; the admin console shows what a refund request was for). */
export function findChargeRecord(id: string): ChargeRecord | null {
  return [...mockWallet.charges, ...seedCharges()].find((c) => c.id === id) ?? null;
}

function seedCharges(): ChargeRecord[] {
  return CHARGE_ROWS.map(([daysAgo, time, method, fnAmount, status], i) => {
    const chargedAt = stamp(daysAgo, time);
    const m = METHODS[method];
    return {
      id: `ch${i + 1}`,
      chargedAt,
      methodEmoji: m.emoji,
      methodLabel: m.label,
      methodDetail: m.detail,
      fnAmount,
      paidAmount: status === "CANCELLED" ? 0 : Math.round(fnAmount * 1.1),
      status,
      transactionId: status === "CANCELLED" ? null : `TXN-${chargedAt.slice(0, 10).replaceAll("-", "")}-${String((9124 + i * 3571) % 100_000).padStart(5, "0")}`
    };
  });
}

// Creator names come from the app's mock creators (Figma 632:4 lists real streamers; not reused here).
const DONATION_ROWS: [number, string, string, string, string, number, string, DonationCategory, DonationStatus][] = [
  [0, "21:45:12", "c4", "불꽃크루", "오늘 엑셀방송 역대급이네요! 다음 회차도 기대할게요", 10_000, "시그니처 후원", "basic", "COMPLETED"],
  [0, "20:12:05", "c1", "하루봄", "항상 따뜻한 소통 방송 감사합니다", 5_000, "일반 후원", "basic", "COMPLETED"],
  [1, "23:58:44", "c5", "새벽감성", "어제 새벽 사연 읽어주신 거 감동이었어요", 30_000, "위시리스트 후원", "basic", "COMPLETED"],
  [1, "19:30:15", "c3", "밤톨게임", "랭크 승급 축하해요!", 2_000, "일반 후원", "basic", "COMPLETED"],
  [2, "15:05:22", "c6", "먹깨비소이", "맛있게 드세요! 다음 메뉴 추천합니다", 10_000, "영상 후원", "basic", "PROCESSING"],
  [3, "22:18:11", "c2", "도도쭈", "신청곡 불러주셔서 감사해요", 50_000, "일반 후원", "basic", "COMPLETED"],
  [4, "21:02:49", "c10", "별빛크루", "직급전 무대 감동이었습니다", 3_000, "미니 후원", "basic", "COMPLETED"],
  [5, "18:40:30", "c8", "댕댕하우스", "강아지들 너무 귀여워요 간식비!", 1_000, "일반 후원", "basic", "COMPLETED"],
  [5, "14:15:00", "c7", "린토끼", "그림 방송 너무 힐링돼요", 20_000, "시그니처 후원", "basic", "REFUNDED"],
  [6, "19:11:58", "c9", "맛있는 하루", "레시피 따라 해봤는데 성공했어요", 5_000, "일반 후원", "basic", "COMPLETED"],
  [9, "20:30:00", "c4", "불꽃크루", "다음 회차도 기대합니다", 5_000, "룰렛 후원", "game", "COMPLETED"],
  [15, "21:10:44", "c1", "하루봄", "오늘 사연 너무 재밌어요", 3_000, "일반 후원", "basic", "FAILED"],
  [2, "22:05:10", "c4", "불꽃크루", "퀘스트: 막내 개인기 한 번!", 10_000, "퀘스트 후원", "quest", "COMPLETED"],
  [8, "19:55:31", "c6", "먹깨비소이", "퀘스트: 매운맛 도전", 20_000, "퀘스트 후원", "quest", "PROCESSING"],
  [3, "23:15:02", "c2", "도도쭈", "룰렛 돌려주세요!", 1_000, "룰렛", "game", "COMPLETED"],
  [12, "20:40:19", "c10", "별빛크루", "뽑기 한 판 갑니다", 2_000, "뽑기 후원", "game", "COMPLETED"]
];

/** All donation records of the signed-in mock member (server-side; used by supporter identity). */
export function listDonationRecords(): (DonationRecord & { category: DonationCategory; hideProfile?: boolean })[] {
  return mockDonations();
}

/** Donations of every account the slot has had, with their account's start marker, like `listAccountChargeRecords`. */
export function listAccountDonationRecords(): (DonationRecord & { category: DonationCategory; hideProfile?: boolean; account: string | null })[] {
  return [...mockWallet.donations.map((d) => ({ ...d, account: accountAt(d.donatedAt) })), ...seedDonations().map((d) => ({ ...d, account: null }))];
}

/** Records of the current account only: after a 재가입 the withdrawn account's history is not shown. */
function mockDonations(): (DonationRecord & { category: DonationCategory; hideProfile?: boolean })[] {
  const since = accountSince();
  return since ? mockWallet.donations.filter((d) => d.donatedAt >= since) : [...mockWallet.donations, ...seedDonations()];
}

function seedDonations(): (DonationRecord & { category: DonationCategory })[] {
  return DONATION_ROWS.map(([daysAgo, time, creatorId, creatorName, message, fnAmount, typeLabel, category, status], i) => ({
    id: `dn${i + 1}`,
    donatedAt: stamp(daysAgo, time),
    creatorId,
    creatorName,
    message,
    fnAmount,
    typeLabel,
    category,
    status
  })).sort((a, b) => b.donatedAt.localeCompare(a.donatedAt));
}
