import { USE_MOCK } from "@/lib/mock";
import { toDateString } from "@/lib/period";
import { purgeExpired } from "@/services/account/retentionPurge";
import { moderationStore } from "@/services/moderation/moderationCore";
import { getAllCreatorsForAdmin } from "@/services/creators/creators";
import { consoleChargeRows, refundQueue } from "./payments";
import { settlementQueue } from "./settlements";
import { listAccountDonationRecords } from "@/services/wallet/walletHistory";
import { AUDIT_MAX, AUDIT_PAGE, type AdminActor, type AdminDashboard, type AuditEntry, type AuditPage, type AuditTargetMember } from "./adminTypes";
import { auditEntries, recordAudit } from "./auditCore";
import { SAMPLE_MEMBER_ID, slotMemberAt } from "./memberCore";
import { memberLabels } from "./members";
import { pendingChargeCount } from "./pendingCharges";
import { pendingDonationCount } from "./pendingDonations";

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
  purgeExpired(); // records past their retention date are not counted (account/retentionPolicy.ts)
  const month = toDateString(new Date()).slice(0, 7);
  // Every creator, as 크리에이터 관리 lists them: the public directory leaves suspended channels out.
  const creators = await getAllCreatorsForAdmin();
  // Platform totals: every account's records, also those of an account that withdrew and was replaced by a 재가입. 이번 달
  // 충전 = the 완료 rows 결제 · 환불 › 충전 내역 lists for this month, 완료 · FN 미지급 (탈퇴) ones included however they came.
  const completed = consoleChargeRows().filter((c) => c.chargedAt.startsWith(month) && c.status === "COMPLETED");
  // 처리 중 충전: every 처리중 charge whenever it was requested — the same count as 처리 대기 (2026-10-13), not this month's.
  const processingCharges = pendingChargeCount();
  const donations = listAccountDonationRecords().filter((d) => d.donatedAt.startsWith(month) && d.status === "COMPLETED");
  const refunds = refundQueue();
  const settlements = settlementQueue();
  return {
    creators: { total: creators.length, live: creators.filter((c) => c.isLive).length },
    charges: {
      monthCount: completed.length,
      monthFn: completed.reduce((s, c) => s + c.fnAmount, 0),
      monthPaidKrw: completed.reduce((s, c) => s + c.paidAmount, 0),
      processing: processingCharges
    },
    donations: { monthCount: donations.length, monthFn: donations.reduce((s, d) => s + d.fnAmount, 0) },
    pending: {
      // 처리 대기 only; a withdrawn account's waiting requests are counted apart as 처리 불가(탈퇴), and requests on 보류
      // as 보류 (2026-10-08 결정).
      refunds: refunds.waiting,
      refundsBlocked: refunds.blocked,
      refundsHeld: refunds.held,
      settlements: settlements.waiting,
      settlementsHeld: settlements.held,
      reports: moderationStore().reports.filter((r) => r.status === "OPEN").length,
      platformDonations: pendingDonationCount(),
      // 처리 중 충전 (2026-10-12 결정): every account's 처리중 charges, decided in the console.
      processingCharges
    },
    recentAudit: auditEntries().slice(0, 8)
  };
}

export async function listAuditLog(input: { show?: unknown } = {}): Promise<AuditPage | null> {
  assertMock();
  const all = auditEntries();
  const count = Math.min(Math.max(1, Math.floor(Number(input.show)) || AUDIT_PAGE), AUDIT_MAX);
  const labels = await memberLabels();
  // A `member:` target names the member it links to. Entries filed under the slot id before a 재가입 are the withdrawn
  // account's (`…-wN`); the entries themselves are never rewritten.
  const targetMember = (e: AuditEntry): AuditTargetMember | null => {
    if (!e.target?.startsWith("member:")) return null;
    const raw = e.target.slice("member:".length);
    const id = raw === SAMPLE_MEMBER_ID ? slotMemberAt(e.at) : raw;
    const label = labels.get(id);
    return label ? { id, name: label.name, withdrawn: label.withdrawn } : null;
  };
  return { items: all.slice(0, count).map((e) => ({ ...e, targetMember: targetMember(e) })), total: all.length, hasMore: all.length > count };
}
