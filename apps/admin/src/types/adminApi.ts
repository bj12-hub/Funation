/**
 * Admin API contract — the JSON the site serves at `/api/admin/*` (apps/web/src/app/api/admin). The admin
 * app never imports site code; keep this file in step with apps/web/src/services/admin/*Types.ts.
 * When the real backend (apps/api) exists it serves the same contract.
 */

// ── Shared labels ─────────────────────────────────────────────────────────────

export type Role = "SUPPORTER" | "CREATOR" | "ADMIN";
export type Platform = "YOUTUBE" | "FLEXTV" | "SOOP";
export const PLATFORM_LABEL: Record<Platform, string> = { YOUTUBE: "YouTube", FLEXTV: "FlexTV", SOOP: "SOOP" };

export type PlatformCapability = "CHANNEL_PROFILE" | "VIDEO_LIST" | "LIVE_STATUS" | "CHAT_EVENTS" | "DONATION_EVENTS";
export type PlatformErrorCode = "TIMEOUT" | "NOT_FOUND" | "UNAUTHORIZED" | "UNSUPPORTED" | "UNAVAILABLE";
export const PLATFORM_ERROR_LABEL: Record<PlatformErrorCode, string> = {
  TIMEOUT: "플랫폼 응답이 늦어요. 잠시 후 다시 시도해 주세요.",
  NOT_FOUND: "채널을 찾을 수 없어요.",
  UNAUTHORIZED: "연결 권한이 만료됐어요. 다시 연결해 주세요.",
  UNSUPPORTED: "이 플랫폼은 아직 지원하지 않는 기능이에요.",
  UNAVAILABLE: "플랫폼에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
};

// ── Audit · dashboard ─────────────────────────────────────────────────────────

export type AuditAction = "ADMIN_SIGN_IN" | "ADMIN_SIGN_OUT" | "MEMBER_SUSPEND" | "MEMBER_RESTORE" | "REFUND_APPROVE" | "REFUND_REJECT" | "SETTLEMENT_APPROVE" | "SETTLEMENT_REJECT" | "CONTENT_UPDATE" | "SYSTEM_UPDATE" | "REPORT_DISMISS" | "REPORT_HIDE";

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
  SYSTEM_UPDATE: "시스템 설정 변경",
  REPORT_DISMISS: "신고 기각",
  REPORT_HIDE: "신고 콘텐츠 숨김"
};

export type AuditEntry = { id: string; at: string; actorId: string; actorName: string; action: AuditAction; target: string | null; reason: string | null };

export type AdminDashboard = {
  creators: { total: number; live: number };
  charges: { monthCount: number; monthFn: number; monthPaidKrw: number; processing: number };
  donations: { monthCount: number; monthFn: number };
  pending: { refunds: number; settlements: number; reports: number | null };
  recentAudit: AuditEntry[];
};

export type AuditPage = { items: AuditEntry[]; total: number; hasMore: boolean };
export const AUDIT_PAGE = 30;

// ── Members · creators ────────────────────────────────────────────────────────

export type MemberStatus = "ACTIVE" | "SUSPENDED";
export type Suspension = { reason: string; at: string; until: string | null; by: string };
export type AdminMember = {
  id: string;
  nickname: string;
  funationId: string;
  roles: Role[];
  joinedAt: string;
  lastActiveAt: string;
  status: MemberStatus;
  suspension: Suspension | null;
  fnBalance: number;
  donationTotalFn: number;
  creatorId: string | null;
};
export type MemberFilter = { q: string; role: "ALL" | "SUPPORTER" | "CREATOR"; status: "ALL" | MemberStatus; page: number };
export type MemberPage = { items: AdminMember[]; total: number; page: number; totalPages: number; filter: MemberFilter };
export type MemberDetail = { member: AdminMember; audit: AuditEntry[] };
export type AdminCreatorRow = { creatorId: string; name: string; memberId: string; isLive: boolean; subscriberCount: number; joinedAt: string; status: MemberStatus };

export const SUSPEND_DAYS = [1, 7, 30, null] as const;
export const SUSPEND_REASON = { min: 5, max: 200 } as const;

// ── Payments · donations ──────────────────────────────────────────────────────

export type ChargeStatus = "PROCESSING" | "COMPLETED" | "CANCELLED";
export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = { PROCESSING: "처리중", COMPLETED: "완료", CANCELLED: "취소" };
export type RefundStatus = "REQUESTED" | "APPROVED" | "REJECTED";

export type AdminChargeRow = {
  id: string;
  chargedAt: string;
  methodLabel: string;
  fnAmount: number;
  paidAmount: number;
  status: ChargeStatus;
  transactionId: string | null;
  refund?: { status: RefundStatus; requestedAt: string } | null;
  memberId: string;
  memberName: string;
};

export type AdminRefund = {
  chargeId: string;
  memberId: string;
  memberName: string;
  requestedAt: string;
  reason: string;
  status: RefundStatus;
  decision: { at: string; by: string; note: string } | null;
  charge: { chargedAt: string; fnAmount: number; paidAmount: number; methodLabel: string; transactionId: string | null } | null;
};

export type PaymentsView = { charges: AdminChargeRow[]; refunds: AdminRefund[]; balance: number };
export const REFUND_NOTE = { min: 2, max: 200 } as const;

export type DonationStatus = "COMPLETED" | "PROCESSING" | "FAILED" | "REFUNDING" | "REFUNDED";
export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = { COMPLETED: "완료", PROCESSING: "처리중", FAILED: "실패", REFUNDING: "환불중", REFUNDED: "환불완료" };
export const DONATION_STATUSES: DonationStatus[] = ["COMPLETED", "PROCESSING", "FAILED", "REFUNDING", "REFUNDED"];

export type AdminDonationRow = { id: string; donatedAt: string; creatorName: string; fnAmount: number; typeLabel: string; status: DonationStatus; memberId: string; memberName: string };
export type DonationsView = {
  rows: AdminDonationRow[];
  byStatus: Record<DonationStatus, { count: number; fn: number }>;
  byType: { typeLabel: string; count: number; fn: number }[];
};

// ── Settlements ───────────────────────────────────────────────────────────────

export type SettlementStatus = "PENDING" | "APPROVED" | "REJECTED";
export const SETTLEMENT_STATUSES: SettlementStatus[] = ["PENDING", "APPROVED", "REJECTED"];
export type AdminSettlementRow = {
  id: string;
  creatorName: string;
  status: SettlementStatus;
  requestedAt: string;
  periodFrom: string;
  periodTo: string;
  amountFn: number;
  feeFn: number;
  netKrw: number;
  payoutDate: string | null;
  review: { at: string; by: string; note: string } | null;
};
export type AdminSettlementView = {
  rows: AdminSettlementRow[];
  counts: Record<SettlementStatus, number>;
  registration: { memberType: string; registrant: string; holder: string; bankName: string; accountMasked: string; code: string; submittedAt: string } | null;
  availableFn: number;
};
export const SETTLEMENT_NOTE = { min: 2, max: 200 } as const;

// ── Content ───────────────────────────────────────────────────────────────────

export const NOTICE_CATEGORY_LABEL = { GENERAL: "일반", UPDATE: "업데이트", CHECK: "점검" } as const;
export type NoticeCategory = keyof typeof NOTICE_CATEGORY_LABEL;
export type Notice = { id: string; category: NoticeCategory; important: boolean; title: string; summary: string; body: string[]; date: string; views: number };

export const FAQ_CATEGORIES = [
  { key: "ACCOUNT", label: "계정/로그인" },
  { key: "CHARGE", label: "결제/충전" },
  { key: "DONATION", label: "후원" },
  { key: "SETTLEMENT", label: "정산/출금" },
  { key: "CREATOR", label: "크리에이터" },
  { key: "WIDGET", label: "위젯" },
  { key: "EVENT", label: "이벤트" },
  { key: "COMMUNITY", label: "커뮤니티" },
  { key: "GENERAL", label: "일반" }
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]["key"];
export type FaqItem = { id: string; category: FaqCategory; question: string; answer: string | null; link?: { href: string; label: string } };

export const NOTICE_LIMITS = { title: 80, summary: 200, body: 5_000 } as const;
export const FAQ_LIMITS = { question: 120, answer: 1_000, linkLabel: 20 } as const;

// ── Platforms · system ────────────────────────────────────────────────────────

export type PlatformStatusRow = {
  platform: Platform;
  capabilities: PlatformCapability[];
  connection: { connected: boolean; channelTitle: string | null; lastSyncedAt: string | null; lastError: PlatformErrorCode | null; videoCount: number };
  donationLink: { enabled: boolean; received: number; duplicates: number; lastEventAt: string | null };
  lastCheck: { at: string; ok: boolean; latencyMs: number; error: PlatformErrorCode | null } | null;
};

export type SystemView = {
  banner: { enabled: boolean; level: "INFO" | "WARNING"; message: string; href: string | null; updatedAt: string | null; updatedBy: string | null };
  runtime: { mock: boolean; nodeEnv: string; auditEntries: number };
};
export const BANNER_MESSAGE_MAX = 120;

// ── Reports (신고) ─────────────────────────────────────────────────────────────

export type ReportTargetType = "POST" | "COMMENT" | "CHANNEL_POST" | "MESSAGE" | "CREATOR";
export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = { POST: "커뮤니티 글", COMMENT: "댓글", CHANNEL_POST: "채널 커뮤니티 글", MESSAGE: "쪽지", CREATOR: "크리에이터 채널" };
export type ReportReason = "SPAM" | "ABUSE" | "SEXUAL" | "PRIVACY" | "IMPERSONATION" | "ETC";
export const REPORT_REASON_LABEL: Record<ReportReason, string> = { SPAM: "스팸 · 광고", ABUSE: "욕설 · 비하 · 혐오", SEXUAL: "음란 · 선정적 내용", PRIVACY: "개인정보 노출", IMPERSONATION: "사칭", ETC: "기타" };
export type ReportStatus = "OPEN" | "DISMISSED" | "ACTIONED";
export const REPORT_STATUSES: ReportStatus[] = ["OPEN", "DISMISSED", "ACTIONED"];
export type Report = {
  id: string;
  target: { type: ReportTargetType; id: string; parentId?: string };
  authorId: string;
  authorName: string;
  snapshot: string;
  reason: ReportReason;
  detail: string;
  reporterId: string;
  reporterName: string;
  createdAt: string;
  status: ReportStatus;
  resolution: { at: string; by: string; action: "DISMISS" | "HIDE"; note: string } | null;
};
export type AdminReportView = { rows: (Report & { authorIsMember: boolean })[]; counts: Record<ReportStatus, number> };
export const REPORT_NOTE = { min: 2, max: 200 } as const;

// ── Mutation results ──────────────────────────────────────────────────────────

/** Every write returns one of these (`id` for creates; NOT_FOUND / UNAUTHORIZED / UNAVAILABLE from the API). */
export type ActionResult = { status: "OK"; id?: string } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" | "UNAVAILABLE" };
