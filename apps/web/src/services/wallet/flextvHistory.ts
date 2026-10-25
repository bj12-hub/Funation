import { fetchMyDonations, gameResultText, type MyFlextvDonation } from "@/lib/flextv/ssumnationBroadcast";
import { PAY_TYPE_LABEL, REX_UNIT_PRICE, fetchBalance, fetchPayments, fetchSpends, kstStamp, type FlextvPayment, type FlextvSpend } from "@/lib/flextv/wallet";
import { getFlextvAccessToken } from "@/lib/session";
import type { ChargeRecord, DonationRecord, LedgerEntry } from "./walletTypes";

/**
 * 충전 내역 · FN Wallet on the FLEXTV backend (phase 2). FLEXTV pages its lists by offset only (no period filter), so
 * this reads back until the period's start — at most MAX_ROWS rows — and ./walletHistory.ts filters and pages them as
 * it does the mock's. The amounts are FLEXTV's.
 */

const PAGE = 50;
const MAX_ROWS = 1_000;

async function readBack<T extends { at: string }>(read: (offset: number) => Promise<{ items: T[]; count: number }>, since: string | null): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { items, count } = await read(offset);
    rows.push(...items);
    const last = items.at(-1);
    if (items.length < PAGE || offset + PAGE >= count || (since && last && last.at.slice(0, 10) < since)) break;
  }
  return rows;
}

/** FLEXTV's paid charge as a 충전 내역 row. Its `price` is the total paid; a unit price (110) is turned into the total. */
export function chargeRecordOf(p: FlextvPayment): ChargeRecord {
  const method = (p.payType !== null && PAY_TYPE_LABEL[p.payType]) || { label: "결제", emoji: "💳" };
  const paid = p.price === REX_UNIT_PRICE && p.rex > 1 ? p.price * p.rex : p.price;
  return {
    id: `flextv-${p.id}`,
    chargedAt: p.at,
    methodEmoji: method.emoji || "💳",
    methodLabel: method.label,
    methodDetail: null,
    fnAmount: p.rex,
    paidAmount: paid,
    status: "COMPLETED",
    transactionId: p.id
  };
}

/** FLEXTV `sponsor_list` status: 9 done; others are still being processed or were taken back. */
export function spendEntryOf(s: FlextvSpend): LedgerEntry {
  const done = s.status === 9;
  return {
    id: `flextv-spend-${s.id}`,
    kind: "USE",
    description: s.targetNick ? `후원 · ${s.targetNick}` : "후원",
    deltaFn: -s.rex,
    statusLabel: done ? "완료" : "처리중",
    tone: done ? "done" : "pending",
    at: s.at.slice(0, 16)
  };
}

export async function chargeRecords(since: string | null): Promise<ChargeRecord[] | null> {
  const token = await getFlextvAccessToken();
  if (!token) return null;
  const rows = await readBack((offset) => fetchPayments(token, { offset, limit: PAGE }), since);
  return rows.map(chargeRecordOf);
}

export async function walletLedger(since: string | null): Promise<{ balance: number; charges: ChargeRecord[]; spends: LedgerEntry[] } | null> {
  const token = await getFlextvAccessToken();
  if (!token) return null;
  const [balance, payments, spends] = await Promise.all([
    fetchBalance(token),
    readBack((offset) => fetchPayments(token, { offset, limit: PAGE }), since),
    readBack((offset) => fetchSpends(token, { offset, limit: PAGE }), since)
  ]);
  if (balance === null) return null;
  return { balance, charges: payments.map(chargeRecordOf), spends: spends.map(spendEntryOf) };
}

/**
 * 후원 내역 from FLEXTV's sent-donation list. It names the recipient (nickname) but not the channel, the message or
 * the kind, so a row shows the name without a link and "후원" as its type.
 */
export function donationRecordOf(s: FlextvSpend): DonationRecord {
  return {
    id: `flextv-spend-${s.id}`,
    donatedAt: s.at,
    creatorId: "",
    creatorName: s.targetNick,
    message: "",
    fnAmount: s.rex,
    typeLabel: "후원",
    status: s.status === 9 ? "COMPLETED" : "PROCESSING"
  };
}

export async function donationRecords(since: string | null): Promise<DonationRecord[] | null> {
  const token = await getFlextvAccessToken();
  if (!token) return null;
  const rows = await readBack((offset) => fetchSpends(token, { offset, limit: PAGE }), since);
  return rows.map(donationRecordOf);
}

export async function walletBalance(): Promise<number | null> {
  const token = await getFlextvAccessToken();
  return token ? fetchBalance(token) : null;
}

/* ── 퀘스트 후원 · 게임 후원 (phase 6) ───────────────────── */

const OWN_TYPE_LABEL: Record<string, string> = { QUEST: "퀘스트 후원", ROULETTE: "룰렛 후원", GACHA: "뽑기 후원" };

/**
 * A 퀘스트 or 룰렛 · 뽑기 row from FLEXTV's Ssumnation list. A quest row carries the quest's own id, which its 성공 · 실패
 * buttons decide (decideMyQuest).
 */
export function ownTypeRecordOf(d: MyFlextvDonation): DonationRecord {
  const refunded = d.status === "REFUNDED";
  return {
    id: d.quest?.id ?? `flextv-${d.id}`,
    donatedAt: kstStamp(d.donatedAt) ?? d.donatedAt,
    creatorId: d.channelId,
    creatorName: d.channelName,
    message: d.message,
    fnAmount: d.amount,
    typeLabel: OWN_TYPE_LABEL[d.type] ?? "후원",
    status: d.status,
    ...(refunded ? { refundedAt: kstStamp(d.refundedAt) ?? undefined, fnReturned: true } : {}),
    ...(d.quest ? { quest: { status: d.quest.status, canDecide: d.quest.status === "IN_PROGRESS", endsAt: d.quest.endsAt, extendedMin: d.quest.extendedMin } } : {}),
    ...(d.game ? { gameResult: gameResultText(d.game) } : {})
  };
}

export async function ownTypeRecords(category: "quest" | "game", since: string | null): Promise<DonationRecord[] | null> {
  const token = await getFlextvAccessToken();
  if (!token) return null;
  let unauthorized = false;
  const rows = await readBack(async (offset) => {
    const page = await fetchMyDonations(token, { category, offset, limit: PAGE });
    if (!page) unauthorized = true;
    return { items: (page?.items ?? []).map((d) => ({ ...d, at: kstStamp(d.donatedAt) ?? d.donatedAt })), count: page?.count ?? 0 };
  }, since);
  return unauthorized ? null : rows.map(ownTypeRecordOf);
}
