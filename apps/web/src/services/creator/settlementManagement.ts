"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { mockSettlement, toHistoryItem } from "./mockSettlementStore";
import { MANAGE_PAGE_SIZE, SETTLEMENT_STATUS_LABEL, isManagePeriod, type ManagePeriod, type ResetResult, type SettlementCsvResult, type SettlementManageView } from "./settlementTypes";
import { toCsv } from "@/lib/csv";
import { isIsoDate, presetRange } from "@/lib/period";

/**
 * 정산 관리 — Figma 478:2 (월별) · 479:144 (기간별) · 480:2 (정산 정보 변경).
 * History is filtered by 신청일 on the server. TBD: creator role check, whether a re-registration
 * is allowed while a request is pending (466:2 says pending requests keep the old information),
 * retention of the removed registration for audit, 세금계산서/증빙 downloads.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Settlement API is not connected yet.");
};

/** The 조회 기간 as the screen sends it: a preset, or 기간별 dates (bad ones fall back to this month, a reversed range swaps). */
function periodOf(params: { period?: unknown; from?: unknown; to?: unknown }): { period: ManagePeriod; from: string; to: string } {
  // Default 연별 so the whole recent history is visible on first load.
  const period: ManagePeriod = isManagePeriod(params.period) ? params.period : "year";
  if (period !== "custom") return { period, ...presetRange(period) };
  const fallback = presetRange("month");
  const from = isIsoDate(params.from) ? params.from : fallback.from;
  const to = isIsoDate(params.to) ? params.to : fallback.to;
  return from > to ? { period, from: to, to: from } : { period, from, to };
}

export async function getSettlementManageView(params: { period?: unknown; from?: unknown; to?: unknown; page?: unknown }): Promise<SettlementManageView | "UNAUTHORIZED" | "NOT_REGISTERED"> {
  assertMock();
  if (!(await getCreatorSession())) return "UNAUTHORIZED";
  const reg = mockSettlement.registration;
  if (!reg) return "NOT_REGISTERED";

  const { period, from, to } = periodOf(params);
  await mockDelay(250);
  const filtered = mockSettlement.requests.filter((r) => r.requestedAt >= from && r.requestedAt <= to);
  const totalPages = Math.max(1, Math.ceil(filtered.length / MANAGE_PAGE_SIZE));
  const pageNum = Number(params.page);
  const page = Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= totalPages ? pageNum : 1;

  return {
    registrant: reg.registrant,
    bankName: reg.bankName,
    accountMasked: reg.accountMasked,
    memberType: reg.memberType,
    period,
    from,
    to,
    items: filtered.slice((page - 1) * MANAGE_PAGE_SIZE, page * MANAGE_PAGE_SIZE).map(toHistoryItem),
    page,
    totalPages
  };
}

/**
 * 정산 내역 CSV 다운로드 (code-first, 2026-11-01 — policy-decisions 1(b)의 "정산 내역 CSV 내려받기(크리에이터 본인 데이터)"): every
 * request of the 조회 기간 (all pages), with what the table shows — no 정산 정보, operator memo or transfer reference.
 * 거절 · 탈퇴 소멸 rows leave 수수료 · 정산 금액 empty, as the table shows "-".
 */
export async function exportSettlementHistoryCsv(params: { period?: unknown; from?: unknown; to?: unknown }): Promise<SettlementCsvResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!mockSettlement.registration) return { status: "NOT_REGISTERED" };
  const { from, to } = periodOf(typeof params === "object" && params !== null ? params : {});
  await mockDelay(250);
  const items = mockSettlement.requests.filter((r) => r.requestedAt >= from && r.requestedAt <= to).map(toHistoryItem);
  const csv = toCsv(
    ["상태", "신청일", "정산 기간 시작", "정산 기간 끝", "신청 금액(FN)", "수수료(FN)", "정산 금액(원)", "지급 예정일", "지급 완료일", "거절 사유"],
    items.map((r) => {
      const none = r.status === "REJECTED" || r.status === "FORFEITED";
      return [SETTLEMENT_STATUS_LABEL[r.status], r.requestedAt, r.periodFrom, r.periodTo, r.amountFn, none ? "" : r.feeFn, none ? "" : r.netKrw, r.payoutDate ?? "", r.paidAt ?? "", r.reviewNote ?? ""];
    })
  );
  return { status: "OK", filename: `ssumnation-settlements-${from}_${to}.csv`, csv, rows: items.length };
}

/**
 * 정산 정보 변경 → 변경하기 (480:2): "현재의 정보는 삭제되며, 정산 정보 재등록이 진행됩니다." Removes the
 * current registration so the 정산 등록 flow starts again. Existing requests are kept and still carry
 * the registration copied when they were made (466:2), so a pending one is reviewed and paid with that.
 * Whether a reset is allowed while a request is pending stays TBD (allowed for now).
 */
export async function resetSettlementRegistration(): Promise<ResetResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!mockSettlement.registration) return { status: "NOT_REGISTERED" };
  await mockDelay(400);
  // TODO: the backend archives the old registration for audit instead of deleting it outright.
  mockSettlement.registration = null;
  mockSettlement.terms = null;
  return { status: "RESET" };
}
