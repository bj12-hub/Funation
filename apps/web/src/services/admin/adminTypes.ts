/**
 * 관리자 콘솔 — code-first (docs/figma/screen-inventory.md "Admin"). Client-safe types.
 * Admin actions are recorded in an append-only audit log; who may do what (admin sub-roles) is TBD.
 */

export type AuditAction = "ADMIN_SIGN_IN" | "ADMIN_SIGN_OUT" | "MEMBER_SUSPEND" | "MEMBER_RESTORE" | "REFUND_APPROVE" | "REFUND_REJECT" | "SETTLEMENT_APPROVE" | "SETTLEMENT_REJECT" | "CONTENT_UPDATE" | "SYSTEM_UPDATE";

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  ADMIN_SIGN_IN: "관리자 로그인",
  ADMIN_SIGN_OUT: "관리자 로그아웃",
  MEMBER_SUSPEND: "회원 이용 정지",
  MEMBER_RESTORE: "회원 정지 해제",
  REFUND_APPROVE: "환불 승인",
  REFUND_REJECT: "환불 거절",
  SETTLEMENT_APPROVE: "정산 승인",
  SETTLEMENT_REJECT: "정산 반려",
  CONTENT_UPDATE: "콘텐츠 변경",
  SYSTEM_UPDATE: "시스템 설정 변경"
};

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

export type AuditPage = { items: AuditEntry[]; total: number; hasMore: boolean };

export const AUDIT_PAGE = 30;
