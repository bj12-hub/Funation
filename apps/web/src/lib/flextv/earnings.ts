import { FlextvUnavailableError, flextvRequest, isRecord } from "./client";
import { kstStamp } from "./wallet";

/**
 * The 후원 a FLEXTV streamer received (docs/development/flextv-backend.md "5단계"): FLEXTV's list of received 렉스 and
 * its 수익 summary. Pure readers are tested in `earnings.test.ts`.
 *
 * FLEXTV has no totals per period: the studio adds up the list (lib/flextv's callers cap how much they read).
 */

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null);

/** The rows FLEXTV's own sums count (its `findReceivedSumLuv`): 0, 1 and 9. */
const COUNTED = [0, 1, 9];

export type ReceivedGift = {
  id: string;
  /** KST "yyyy-mm-dd hh:mm:ss". */
  at: string;
  rex: number;
  donorNickname: string;
  /** The sender's FLEXTV 아이디, only to tell donors apart: never shown. */
  donorKey: string;
  /** A 선물 상품's name, null for plain 렉스. */
  productName: string | null;
  /** Counted in FLEXTV's 수익 (statuses 0 · 1 · 9). */
  counted: boolean;
};

/** `GET /api/luv/receivedluv-list` with `sendLexOption=ViewByCase`: one row per 후원, newest first. */
export function readReceived(data: unknown): { items: ReceivedGift[]; count: number } {
  const rows = isRecord(data) && Array.isArray(data.data) ? data.data : [];
  const items = rows.flatMap((row): ReceivedGift[] => {
    if (!isRecord(row)) return [];
    const id = num(row.id);
    const at = kstStamp(row.createdAt);
    const rex = num(row.amount);
    if (id === null || !at || rex === null) return [];
    const status = num(row.status);
    return [
      {
        id: String(id),
        at,
        rex,
        donorNickname: typeof row.membernick === "string" && row.membernick ? row.membernick : "알 수 없음",
        donorKey: typeof row.memberId === "string" || typeof row.memberId === "number" ? String(row.memberId) : `row-${id}`,
        productName: typeof row.productName === "string" && row.productName ? row.productName : null,
        counted: status !== null && COUNTED.includes(status)
      }
    ];
  });
  return { items, count: (isRecord(data) ? num(data.count) : null) ?? items.length };
}

export type ReceivedQuery = {
  offset: number;
  /** FLEXTV answers at most 50. */
  limit: number;
  /** KST dates (yyyy-mm-dd), both or neither. */
  from?: string;
  to?: string;
  /** FLEXTV's exact 닉네임 search. */
  nickname?: string;
};

export function receivedPath({ offset, limit, from, to, nickname }: ReceivedQuery): string {
  const sp = new URLSearchParams({ offset: String(Math.max(0, Math.floor(offset))), limit: String(Math.min(50, Math.max(1, Math.floor(limit)))), mobile: "false", sendLexOption: "ViewByCase" });
  // FLEXTV compares the timestamps as text: a bare end date would leave its day out.
  if (from && to) {
    sp.set("selectedStartDay", `${from} 00:00:00`);
    sp.set("selectedEndDay", `${to} 23:59:59`);
  }
  if (nickname) {
    sp.set("title", nickname);
    sp.set("searchOptions", "1");
  }
  return `/api/luv/receivedluv-list?${sp}`;
}

export async function fetchReceived(token: string, query: ReceivedQuery) {
  const response = await flextvRequest(receivedPath(query), { token });
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV received list answered ${response.status}`);
  return readReceived(response.data);
}

export type ReceivedSummary = {
  /** 오늘 받은 렉스 (FLEXTV subtracts today's cancellations). */
  today: number;
  /** 받은 렉스 누적. */
  accumulated: number;
  /** 보유한 환전 가능 렉스. */
  exchangeable: number;
  /** 환전 신청 중 (requested, in review, approved, waiting for the transfer). */
  exchanging: number;
  /** 환전 완료. */
  exchanged: number;
};

/** `GET /api/luv/receivedluv-sum`; FLEXTV sends null for a sum with no rows. */
export function readReceivedSummary(data: unknown): ReceivedSummary | null {
  if (!isRecord(data)) return null;
  const n = (value: unknown) => Math.max(0, num(value) ?? 0);
  return { today: n(data.todayamount), accumulated: n(data.accumulateamount), exchangeable: n(data.received), exchanging: n(data.pendingdepositamount), exchanged: n(data.exchangeamount) };
}

export async function fetchReceivedSummary(token: string): Promise<ReceivedSummary> {
  const response = await flextvRequest("/api/luv/receivedluv-sum", { token });
  const summary = response.status === 200 ? readReceivedSummary(response.data) : null;
  if (!summary) throw new FlextvUnavailableError(`FLEXTV received summary answered ${response.status}`);
  return summary;
}
