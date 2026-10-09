"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { accountSince } from "@/services/account/withdrawalCore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { mockPlatform } from "./mockPlatformStore";
import { recheckPending } from "./pendingCore";
import { HISTORY_LIST_MAX, HISTORY_PERIODS, HISTORY_SORTS, HISTORY_STATUS_LABEL, HISTORY_TABS, type HistoryItem, type HistoryPeriod, type HistoryStatus, type HistoryTab, type HistoryView } from "./platformTypes";

/**
 * 후원 내역 — Figma 817:8038 (table + 거래 상세) · 817:8223 (status badges + detail).
 * Merges platform transactions (SOOP · FlexTV) with Ssumnation 직접 후원 (creator room, "Direct").
 * Filtering happens on the server. A read first re-checks this account's PENDING platform donations that are still
 * inside their 24 h (2026-10-08 결정, ./pendingCore.ts). TBD: the meaning of Direct, refund workflow behind
 * 환불중/환불완료, retention period, pagination size.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Donation history API is not connected yet.");
};

const oneOf = <T extends string>(list: readonly { key: T }[], v: unknown, fallback: T): T => (list.some((x) => x.key === v) ? (v as T) : fallback);
const isStatus = (v: unknown): v is HistoryStatus => typeof v === "string" && Object.hasOwn(HISTORY_STATUS_LABEL, v);

function allItems(): HistoryItem[] {
  // Only the current account's records: the mock's 재가입 keeps the user id, and the withdrawn account's donations
  // are not restored (services/account/rejoin.ts) — the same rule as the wallet history.
  const since = accountSince();
  const platform: HistoryItem[] = mockPlatform.transactions.filter((t) => (t.account ?? null) === since).map((t) => ({
    transactionId: t.transactionId,
    externalTransactionId: t.externalTransactionId,
    source: t.platform,
    creatorName: t.creatorName,
    productLabel: t.productLabel,
    fnAmount: t.fnAmount,
    status: t.status,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    failureReason: t.failureReason
  }));
  // Creator-room donations recorded in the wallet, minus the platform ones mirrored there
  // (platformDonation.ts writes those with a "soop:" / "flextv:" creator id).
  const direct: HistoryItem[] = mockWallet.donations
    .filter((d) => !/^(soop|flextv):/.test(d.creatorId) && (!since || d.donatedAt >= since))
    .map((d) => ({
      transactionId: d.id,
      externalTransactionId: null,
      source: "DIRECT",
      creatorName: d.creatorName,
      productLabel: d.typeLabel,
      fnAmount: d.fnAmount,
      status: d.status,
      createdAt: d.donatedAt.slice(0, 16),
      completedAt: d.status === "COMPLETED" ? d.donatedAt.slice(0, 16) : null,
      failureReason: null
    }));
  return [...platform, ...direct].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDonationHistory(params: { tab?: unknown; period?: unknown; status?: unknown; q?: unknown; sort?: unknown; tx?: unknown }): Promise<HistoryView | null> {
  assertMock();
  if (!(await getSession())) return null;
  const tab: HistoryTab = oneOf(HISTORY_TABS, params.tab, "all");
  const period: HistoryPeriod = oneOf(HISTORY_PERIODS, params.period, "30");
  const status = isStatus(params.status) ? params.status : "all";
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 40) : "";
  const sort = oneOf(HISTORY_SORTS, params.sort, "newest");

  const own = accountSince();
  await recheckPending((t) => (t.account ?? null) === own);
  await mockDelay(250);
  const since = period === "all" ? "" : (() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(period));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const source = tab === "all" ? null : tab === "direct" ? "DIRECT" : tab === "soop" ? "SOOP" : "FLEXTV";
  const needle = q.toLowerCase();

  const items = allItems().filter(
    (i) =>
      (!source || i.source === source) &&
      (!since || i.createdAt >= since) &&
      (status === "all" || i.status === status) &&
      (!needle || i.creatorName.toLowerCase().includes(needle) || i.transactionId.toLowerCase().includes(needle) || (i.externalTransactionId ?? "").toLowerCase().includes(needle))
  );
  if (sort === "oldest") items.reverse();
  const selected = typeof params.tx === "string" ? (items.find((i) => i.transactionId === params.tx) ?? null) : null;
  const completedFn = items.reduce((sum, i) => (i.status === "COMPLETED" ? sum + i.fnAmount : sum), 0);
  return { balance: mockAccount.fnBalance, tab, period, status, q, sort, items: items.slice(0, HISTORY_LIST_MAX), total: items.length, completedFn, selected };
}
