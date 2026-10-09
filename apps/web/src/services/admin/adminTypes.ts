/**
 * 관리자 콘솔 — code-first (docs/figma/screen-inventory.md "Admin"). Client-safe types.
 * Admin actions are recorded in an append-only audit log; who may do what (admin sub-roles) is TBD.
 */

/** The operator an admin API call acts for (sent by the admin app; how operators authenticate is TBD). */
export type AdminActor = { userId: string; nickname: string };

export type AuditAction =
  | "ADMIN_SIGN_IN"
  | "ADMIN_SIGN_OUT"
  | "MEMBER_SUSPEND"
  | "MEMBER_RESTORE"
  | "REFUND_APPROVE"
  | "REFUND_REJECT"
  | "REFUND_HOLD"
  | "REFUND_RELEASE"
  | "SETTLEMENT_APPROVE"
  | "SETTLEMENT_REJECT"
  | "SETTLEMENT_PAY"
  | "SETTLEMENT_HOLD"
  | "SETTLEMENT_RELEASE"
  | "CONTENT_UPDATE"
  | "SYSTEM_UPDATE"
  | "REPORT_DISMISS"
  | "REPORT_HIDE"
  | "PLATFORM_DONATION_CHECK"
  | "PLATFORM_DONATION_RESOLVE"
  | "EVENT_REWARD_SET"
  | "EVENT_REWARD_PAY"
  | "EVENT_DRAW";

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
  /**
   * `refunds` / `settlements`: 처리 대기 only. `refundsBlocked`: waiting requests of withdrawn accounts, 처리 불가(탈퇴);
   * `refundsHeld` / `settlementsHeld`: requests an operator put on 보류 (2026-10-08 결정) — neither is 처리 대기.
   * `platformDonations`: 확인 중 후원 — SOOP · FlexTV donations with no platform result 24 h after the request (2026-10-08 결정).
   */
  pending: { refunds: number; refundsBlocked: number; refundsHeld: number; settlements: number; settlementsHeld: number; reports: number | null; platformDonations: number };
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

/**
 * 보류 (2026-10-08 결정): an operator flag on a settlement request (심사 대기 · 승인) or a charge refund request (심사 대기)
 * that needs a closer look. While it is on, 승인 · 반려 · 지급 완료 are refused; 보류 해제 puts the request back as it was.
 * It is not a member-facing state: the creator and member screens keep showing 심사 중 / 승인, and the memo stays with
 * the operators.
 */
export type HoldAction = "HOLD" | "RELEASE";
/** The 보류 in force: when, by whom, and the operator's memo. */
export type AdminHold = { at: string; by: string; note: string };
export const HOLD_NOTE = { min: 2, max: 200 } as const;
