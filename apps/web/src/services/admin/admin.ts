import { USE_MOCK } from "@/lib/mock";
import { toDateString } from "@/lib/period";
import { mockSettlement } from "@/services/creator/mockSettlementStore";
import { moderationStore } from "@/services/moderation/moderationCore";
import { getAllCreatorsForAdmin } from "@/services/creators/creators";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { listAccountChargeRecords, listAccountDonationRecords } from "@/services/wallet/walletHistory";
import { AUDIT_MAX, AUDIT_PAGE, type AdminActor, type AdminDashboard, type AuditPage } from "./adminTypes";
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
  // Every creator, as 크리에이터 관리 lists them: the public directory leaves suspended channels out.
  const creators = await getAllCreatorsForAdmin();
  // Platform totals: every account's records, also those of an account that withdrew and was replaced by a 재가입.
  const charges = listAccountChargeRecords().filter((c) => c.chargedAt.startsWith(month));
  const completed = charges.filter((c) => c.status === "COMPLETED");
  const donations = listAccountDonationRecords().filter((d) => d.donatedAt.startsWith(month) && d.status === "COMPLETED");
  return {
    creators: { total: creators.length, live: creators.filter((c) => c.isLive).length },
    charges: {
      monthCount: completed.length,
      monthFn: completed.reduce((s, c) => s + c.fnAmount, 0),
      monthPaidKrw: completed.reduce((s, c) => s + c.paidAmount, 0),
      processing: charges.filter((c) => c.status === "PROCESSING").length
    },
    donations: { monthCount: donations.length, monthFn: donations.reduce((s, d) => s + d.fnAmount, 0) },
    pending: {
      refunds: mockRefunds.requests.filter((r) => r.status === "REQUESTED").length,
      settlements: mockSettlement.requests.filter((r) => r.status === "PENDING").length,
      reports: moderationStore().reports.filter((r) => r.status === "OPEN").length
    },
    recentAudit: auditEntries().slice(0, 8)
  };
}

export async function listAuditLog(input: { show?: unknown } = {}): Promise<AuditPage | null> {
  assertMock();
  const all = auditEntries();
  const count = Math.min(Math.max(1, Math.floor(Number(input.show)) || AUDIT_PAGE), AUDIT_MAX);
  return { items: all.slice(0, count), total: all.length, hasMore: all.length > count };
}
