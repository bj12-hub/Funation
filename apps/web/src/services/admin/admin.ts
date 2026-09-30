import { USE_MOCK } from "@/lib/mock";
import { toDateString } from "@/lib/period";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { getCreators } from "@/services/creators/creators";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { listChargeRecords, listDonationRecords } from "@/services/wallet/walletHistory";
import { AUDIT_PAGE, type AdminActor, type AdminDashboard, type AuditPage } from "./adminTypes";
import { auditEntries, recordAudit } from "./auditCore";

/**
 * 관리자 API logic — code-first. Server-only: called by the admin API routes (`/api/admin/*`), which
 * authorise the separate admin app first (lib/adminApi.ts). Totals are computed here, never in a browser.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin API is not connected yet.");
};

/** The admin app reports operator sign-in / sign-out so they land in the same audit log. */
export async function recordSessionEvent(admin: AdminActor, event: unknown): Promise<{ status: "OK" } | { status: "INVALID"; message: string }> {
  assertMock();
  if (event !== "SIGN_IN" && event !== "SIGN_OUT") return { status: "INVALID", message: "알 수 없는 이벤트예요." };
  recordAudit(admin, event === "SIGN_IN" ? "ADMIN_SIGN_IN" : "ADMIN_SIGN_OUT");
  return { status: "OK" };
}

export async function getAdminDashboard(): Promise<AdminDashboard | null> {
  assertMock();
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
  const all = auditEntries();
  const count = Math.min(Math.max(1, Math.floor(Number(input.show)) || AUDIT_PAGE), 500);
  return { items: all.slice(0, count), total: all.length, hasMore: all.length > count };
}
