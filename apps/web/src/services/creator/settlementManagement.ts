"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { mockSettlement, toHistoryItem } from "./mockSettlementStore";
import { MANAGE_PAGE_SIZE, isManagePeriod, type ManagePeriod, type ResetResult, type SettlementManageView } from "./settlementTypes";
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

export async function getSettlementManageView(params: { period?: unknown; from?: unknown; to?: unknown; page?: unknown }): Promise<SettlementManageView | "UNAUTHORIZED" | "NOT_REGISTERED"> {
  assertMock();
  if (!(await getCreatorSession())) return "UNAUTHORIZED";
  const reg = mockSettlement.registration;
  if (!reg) return "NOT_REGISTERED";

  // Default 연별 so the whole recent history is visible on first load.
  const period: ManagePeriod = isManagePeriod(params.period) ? params.period : "year";
  let { from, to } = period === "custom" ? { from: "", to: "" } : presetRange(period);
  if (period === "custom") {
    const fallback = presetRange("month");
    from = isIsoDate(params.from) ? params.from : fallback.from;
    to = isIsoDate(params.to) ? params.to : fallback.to;
    if (from > to) [from, to] = [to, from];
  }

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
