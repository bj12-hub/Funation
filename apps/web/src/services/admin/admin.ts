"use server";

import { redirect } from "next/navigation";
import { USE_MOCK } from "@/lib/mock";
import { toDateString } from "@/lib/period";
import { endSession, getAdminSession, startMockAdminSession } from "@/lib/session";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { getCreators } from "@/services/creators/creators";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { listChargeRecords, listDonationRecords } from "@/services/wallet/walletHistory";
import { AUDIT_PAGE, type AdminDashboard, type AuditPage } from "./adminTypes";
import { auditEntries, recordAudit } from "./auditCore";

/**
 * 관리자 콘솔 Server Actions — code-first. Routes `/admin/*`. Every read and action re-checks the
 * Admin role on the server (the layout guard is UX only). Totals are computed here, never in the browser.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin API is not connected yet.");
};

/** Development only: the mock operator sign-in (the real admin login and 2FA are TBD). */
export async function signInMockAdmin(): Promise<void> {
  assertMock();
  await startMockAdminSession();
  recordAudit({ userId: "adm-operator", nickname: "운영자" }, "ADMIN_SIGN_IN");
  redirect("/admin");
}

export async function signOutAdmin(): Promise<void> {
  assertMock();
  const session = await getAdminSession();
  if (session) recordAudit(session, "ADMIN_SIGN_OUT");
  await endSession();
  redirect("/admin/login");
}

export async function getAdminDashboard(): Promise<AdminDashboard | null> {
  assertMock();
  if (!(await getAdminSession())) return null;
  const month = toDateString(new Date()).slice(0, 7);
  const creators = await getCreators({ page: 1 });
  const charges = listChargeRecords().filter((c) => c.chargedAt.startsWith(month));
  const completed = charges.filter((c) => c.status === "COMPLETED");
  const donations = listDonationRecords().filter((d) => d.donatedAt.startsWith(month) && d.status === "COMPLETED");
  return {
    creators: { total: creators.totalCount, live: creators.liveCount },
    charges: {
      monthCount: completed.length,
      monthFn: completed.reduce((s, c) => s + c.fnAmount, 0),
      monthPaidKrw: completed.reduce((s, c) => s + c.paidAmount, 0),
      processing: charges.filter((c) => c.status === "PROCESSING").length
    },
    donations: { monthCount: donations.length, monthFn: donations.reduce((s, d) => s + d.fnAmount, 0) },
    // 신고 is not built yet, so its queue is unknown (null) rather than 0.
    pending: { refunds: mockRefunds.requests.filter((r) => r.status === "REQUESTED").length, settlements: mockSettlement.requests.filter((r) => r.status === "PENDING").length, reports: null },
    recentAudit: auditEntries().slice(0, 8)
  };
}

export async function listAuditLog(input: { show?: unknown } = {}): Promise<AuditPage | null> {
  assertMock();
  if (!(await getAdminSession())) return null;
  const all = auditEntries();
  const count = Math.min(Math.max(1, Math.floor(Number(input.show)) || AUDIT_PAGE), 500);
  return { items: all.slice(0, count), total: all.length, hasMore: all.length > count };
}
