/**
 * 관리자 콘솔 — code-first (docs/figma/screen-inventory.md "Admin"). Client-safe types.
 * Admin actions are recorded in an append-only audit log; who may do what (admin sub-roles) is TBD.
 */

/** The operator an admin API call acts for (sent by the admin app; how operators authenticate is TBD). */
export type AdminActor = { userId: string; nickname: string };

export type AuditAction = "ADMIN_SIGN_IN" | "ADMIN_SIGN_OUT" | "MEMBER_SUSPEND" | "MEMBER_RESTORE" | "REFUND_APPROVE" | "REFUND_REJECT" | "SETTLEMENT_APPROVE" | "SETTLEMENT_REJECT" | "CONTENT_UPDATE" | "SYSTEM_UPDATE" | "REPORT_DISMISS" | "REPORT_HIDE";

export type AuditEntry = {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  /** e.g. "member:u-123", "refund:ch-1" */
  target: string | null;
  reason: string | null;
};

export type AdminDashboard = {
  creators: { total: number; live: number };
  charges: { monthCount: number; monthFn: number; monthPaidKrw: number; processing: number };
  donations: { monthCount: number; monthFn: number };
  pending: { refunds: number; settlements: number; reports: number | null };
  recentAudit: AuditEntry[];
};

/**
 * The member an audit entry is about (`member:…` targets), as 감사 로그 links it: the right account also after a 재가입
 * (`…-wN`), with the nickname and whether the member withdrew (shown with a 탈퇴 badge).
 */
export type AuditTargetMember = { id: string; name: string; withdrawn: boolean };
export type AuditLogItem = AuditEntry & { targetMember: AuditTargetMember | null };
export type AuditPage = { items: AuditLogItem[]; total: number; hasMore: boolean };

export const AUDIT_PAGE = 30;
/** The console lists at most this many of the newest entries (searching older ones is TBD). */
export const AUDIT_MAX = 500;
