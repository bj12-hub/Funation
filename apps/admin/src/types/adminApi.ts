/**
 * Admin API contract — the JSON the site serves at `/api/admin/*` (apps/web/src/app/api/admin). The admin
 * app never imports site code; keep this file in step with apps/web/src/services/admin/*Types.ts.
 * When the real backend (apps/api) exists it serves the same contract.
 */

// ── Shared labels ─────────────────────────────────────────────────────────────

export type Role = "SUPPORTER" | "CREATOR" | "ADMIN";
export type Platform = "YOUTUBE" | "FLEXTV" | "SOOP" | "CHZZK";
export const PLATFORM_LABEL: Record<Platform, string> = { YOUTUBE: "YouTube", FLEXTV: "FlexTV", SOOP: "SOOP", CHZZK: "치지직" };

export type PlatformCapability = "CHANNEL_PROFILE" | "VIDEO_LIST" | "LIVE_STATUS" | "CHAT_EVENTS" | "CHAT_SEND" | "CHAT_MODERATE" | "DONATION_EVENTS";
export type PlatformErrorCode = "TIMEOUT" | "NOT_FOUND" | "UNAUTHORIZED" | "UNSUPPORTED" | "UNAVAILABLE";
export const PLATFORM_ERROR_LABEL: Record<PlatformErrorCode, string> = {
  TIMEOUT: "플랫폼 응답이 늦어요. 잠시 후 다시 시도해 주세요.",
  NOT_FOUND: "채널을 찾을 수 없어요.",
  UNAUTHORIZED: "연결 권한이 만료됐어요. 다시 연결해 주세요.",
  UNSUPPORTED: "이 플랫폼은 아직 지원하지 않는 기능이에요.",
  UNAVAILABLE: "플랫폼에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
};

// ── Audit · dashboard ─────────────────────────────────────────────────────────

export type AuditAction =
  | "ADMIN_SIGN_IN"
  | "ADMIN_SIGN_OUT"
  | "MEMBER_SUSPEND"
  | "MEMBER_RESTORE"
  | "MEMBER_FN_SETTLE"
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

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  ADMIN_SIGN_IN: "관리자 로그인",
  ADMIN_SIGN_OUT: "관리자 로그아웃",
  MEMBER_SUSPEND: "회원 이용 정지",
  MEMBER_RESTORE: "회원 정지 해제",
  MEMBER_FN_SETTLE: "남은 FN 정리",
  REFUND_APPROVE: "환불 승인",
  REFUND_REJECT: "환불 거절",
  REFUND_HOLD: "환불 요청 보류",
  REFUND_RELEASE: "환불 요청 보류 해제",
  SETTLEMENT_APPROVE: "정산 승인",
  SETTLEMENT_REJECT: "정산 반려",
  SETTLEMENT_PAY: "정산 지급 완료",
  SETTLEMENT_HOLD: "정산 보류",
  SETTLEMENT_RELEASE: "정산 보류 해제",
  CONTENT_UPDATE: "콘텐츠 변경",
  SYSTEM_UPDATE: "시스템 설정 변경",
  REPORT_DISMISS: "신고 기각",
  REPORT_HIDE: "신고 콘텐츠 숨김",
  PLATFORM_DONATION_CHECK: "확인 중 후원 다시 확인",
  PLATFORM_DONATION_RESOLVE: "확인 중 후원 결과 결정",
  EVENT_REWARD_SET: "이벤트 보상 설정",
  EVENT_REWARD_PAY: "이벤트 보상 지급",
  EVENT_DRAW: "이벤트 당첨자 추첨"
};

export type AuditEntry = { id: string; at: string; actorId: string; actorName: string; action: AuditAction; target: string | null; reason: string | null };

export type AdminDashboard = {
  creators: { total: number; live: number };
  charges: { monthCount: number; monthFn: number; monthPaidKrw: number; processing: number };
  donations: { monthCount: number; monthFn: number };
  /**
   * `refunds` / `settlements`: 처리 대기 only. `refundsBlocked`: waiting requests of withdrawn accounts, 처리 불가(탈퇴);
   * `refundsHeld` / `settlementsHeld`: requests on 보류 — neither is 처리 대기.
   * `platformDonations`: 확인 중 후원 — SOOP · FlexTV donations with no platform result 24 h after the request.
   */
  pending: { refunds: number; refundsBlocked: number; refundsHeld: number; settlements: number; settlementsHeld: number; reports: number | null; platformDonations: number };
  recentAudit: AuditEntry[];
};

/** The member a `member:` target is about: linked by id, named, and marked when they withdrew (also after a 재가입). */
export type AuditTargetMember = { id: string; name: string; withdrawn: boolean };
export type AuditLogItem = AuditEntry & { targetMember: AuditTargetMember | null };
export type AuditPage = { items: AuditLogItem[]; total: number; hasMore: boolean };
export const AUDIT_PAGE = 30;
/** The site lists at most this many of the newest entries (searching older ones is TBD). */
export const AUDIT_MAX = 500;

/**
 * 보류 (2026-10-08 결정): an operator flag on a settlement request (심사 대기 · 승인) or a charge refund request (심사 대기).
 * While it is on, the site refuses 승인 · 반려 · 거절 · 지급 완료; 보류 해제 puts the request back as it was. Members and
 * creators keep seeing 심사 중 / 승인, and the memo stays with the operators.
 */
export type HoldAction = "HOLD" | "RELEASE";
export type AdminHold = { at: string; by: string; note: string };
export const HOLD_NOTE = { min: 2, max: 200 } as const;

// ── Members · creators ────────────────────────────────────────────────────────

export type MemberStatus = "ACTIVE" | "SUSPENDED" | "WITHDRAWN";
export type Suspension = { reason: string; at: string; until: string | null; by: string };
export type RetentionCategory = "CONTRACT" | "PAYMENT" | "DISPUTE" | "ACCESS_LOG" | "PERSON_KEY" | "POSTS";
/**
 * 탈퇴 회원 정보 보관: one row of the site's shared retention list (기본값, 법무 검토 전) with this account's date.
 * `until`: when the category's data goes (null = 삭제하지 않음); `purged`: it has gone.
 */
export type MemberRetention = { category: RetentionCategory; label: string; period: string; basis: string; covers: string; until: string | null; purged: boolean };
export type AdminMember = {
  id: string;
  nickname: string;
  ssumnationId: string;
  roles: Role[];
  joinedAt: string;
  lastActiveAt: string;
  status: MemberStatus;
  suspension: Suspension | null;
  /** 회원 탈퇴: when, the FN and creator earnings the member agreed to forfeit, and until when each kind of data is kept. */
  withdrawal: { at: string; forfeitedFn: number; forfeitedEarningsFn: number; retentionNote: string; retention: MemberRetention[] } | null;
  fnBalance: number;
  donationTotalFn: number;
  creatorId: string | null;
};
export type MemberFilter = { q: string; role: "ALL" | "SUPPORTER" | "CREATOR"; status: "ALL" | MemberStatus; page: number };
export type MemberPage = { items: AdminMember[]; total: number; page: number; totalPages: number; filter: MemberFilter };
/** `fnSettlement`: 남은 FN 정리, for a 영구 정지 member only (null otherwise). */
export type MemberDetail = { member: AdminMember; audit: AuditEntry[]; fnSettlement: MemberFnSettlement | null };
export type AdminCreatorRow = { creatorId: string; name: string; memberId: string; isLive: boolean; subscriberCount: number; joinedAt: string; status: MemberStatus };

/** 회원 · 크리에이터 검색어 길이 (the site cuts longer text). */
export const ADMIN_QUERY_MAX = 40;
/** 이용 정지 기간: days, or `null` = 영구 정지. */
export const SUSPEND_DAYS = [1, 7, 30, null] as const;
export const SUSPEND_REASON = { min: 5, max: 200 } as const;

/**
 * 남은 FN 정리 (2026-10-08 결정): a 영구 정지 member cannot sign in, so on request an operator refunds the remaining paid
 * FN per charge under the site's refund policy and the free FN are forfeited (the balance goes to 0). Every amount is the
 * site's. `status`: READY — can be processed; EMPTY — no FN left; BLOCKED — a refund request waits or is on 보류
 * (`blocked`: the site's message); NO_LEDGER — the site has no wallet ledger for this member (mock: the sample member
 * only). `lines`: per charge, oldest first; `total`: their sums; `forfeitFn`: free FN written off.
 */
export type FnSettlementLine = RefundAmounts & { chargeId: string; chargedAt: string; methodLabel: string; chargeFn: number; paidKrw: number };
export type MemberFnSettlement = {
  status: "READY" | "EMPTY" | "BLOCKED" | "NO_LEDGER";
  blocked: string | null;
  balanceFn: number;
  lines: FnSettlementLine[];
  total: { grossFn: number; feeFn: number; netFn: number; refundKrw: number };
  forfeitFn: number;
  history: { at: string; by: string; note: string; lines: FnSettlementLine[]; forfeitFn: number }[];
};
export const FN_SETTLE_NOTE = { min: 2, max: 200 } as const;

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
  refund: { status: RefundStatus; requestedAt: string } | null;
  memberId: string;
  memberName: string;
  /** The member withdrew: the original nickname is shown with a 탈퇴 badge (2026-10-08 결정). */
  memberWithdrawn: boolean;
  /**
   * 2026-10-10 결정: the payment completed after the member withdrew, so its FN were credited to nobody (완료 · FN 미지급
   * (탈퇴)). What happens to the KRW paid (PG 취소 · 환불) is TBD. Absent from a site older than this field: credited.
   */
  fnNotCredited?: boolean;
};

export type AdminRefund = {
  chargeId: string;
  memberId: string;
  /** The requester's original nickname, also for an account that has since withdrawn. */
  memberName: string;
  /** Filed by an account that has since withdrawn: 탈퇴 badge, and the console cannot decide it. */
  memberWithdrawn: boolean;
  requestedAt: string;
  reason: string;
  status: RefundStatus;
  decision: { at: string; by: string; note: string } | null;
  charge: { chargedAt: string; fnAmount: number; paidAmount: number; methodLabel: string; transactionId: string | null } | null;
  /** The refund the site computed when the member asked (what the member saw). */
  requested: RefundAmounts;
  /** What approval refunded (approved requests only). */
  approved: RefundAmounts | null;
  /** The refund recomputed now — what 승인 applies (waiting requests the console can decide only). */
  current: RefundQuote | null;
  /** 보류 in force (waiting requests only): the site refuses 승인 · 거절 until 보류 해제. */
  hold: AdminHold | null;
};

/**
 * 환불 정책 기본값 (일반적인 기준, 법무 검토 전) — the site computes every amount; the console only shows them.
 * FULL_CANCEL: 청약철회 (전액 취소, no fee); PARTIAL: the charge's unused FN minus the fee; NOT_REFUNDABLE: all used.
 * `grossFn`: FN taken back from the wallet; `feeFn` + `netFn` = `grossFn`. `refundKrw` (2026-10-08 결정): FULL_CANCEL the
 * whole paid amount, PARTIAL net FN ÷ the charge's FN × its paid KRW, rounded down to the won (payout per method: TBD).
 */
export type RefundType = "FULL_CANCEL" | "PARTIAL" | "NOT_REFUNDABLE";
export const REFUND_TYPE_LABEL: Record<RefundType, string> = { FULL_CANCEL: "전액 취소", PARTIAL: "수수료 공제 후 환불", NOT_REFUNDABLE: "환불 불가" };
export type RefundAmounts = { type: Exclude<RefundType, "NOT_REFUNDABLE">; grossFn: number; feeFn: number; netFn: number; refundKrw: number };
export type RefundQuote = { type: RefundType; chargeFn: number; paidKrw: number; usedFn: number; withinPeriod: boolean; grossFn: number; feeFn: number; netFn: number; refundKrw: number };

/** `refundPolicy`: the policy as the site states it (its numbers live on the site only). */
export type PaymentsView = { charges: AdminChargeRow[]; refunds: AdminRefund[]; balance: number; refundPolicy: { label: string; summary: string } };
export const REFUND_NOTE = { min: 2, max: 200 } as const;

export type DonationStatus = "COMPLETED" | "PROCESSING" | "FAILED" | "REFUNDING" | "REFUNDED";
export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = { COMPLETED: "완료", PROCESSING: "처리중", FAILED: "실패", REFUNDING: "환불중", REFUNDED: "환불완료" };

/**
 * 후원 운영 tiles and `?status=`: each status, with FN 반환 apart from 환불완료 — a failed 플랫폼 후원 whose held FN went back
 * is stored REFUNDED with `fnReturned`, but it was never a refund (2026-10-09 결정); REFUNDED counts real refunds only.
 */
export type DonationFilter = DonationStatus | "FN_RETURNED";
export const DONATION_FILTERS: DonationFilter[] = ["COMPLETED", "PROCESSING", "FAILED", "REFUNDING", "REFUNDED", "FN_RETURNED"];
export const DONATION_FILTER_LABEL: Record<DonationFilter, string> = { ...DONATION_STATUS_LABEL, FN_RETURNED: "FN 반환" };

/** `fnReturned`: a failed 플랫폼 후원's held FN that went back (status REFUNDED) — shown as FN 반환, not 환불완료. */
export type AdminDonationRow = {
  id: string;
  donatedAt: string;
  creatorName: string;
  fnAmount: number;
  typeLabel: string;
  status: DonationStatus;
  fnReturned: boolean;
  memberId: string;
  memberName: string;
  memberWithdrawn: boolean;
};
/** The 상태 a 후원 운영 row shows. */
export const donationRowLabel = (d: Pick<AdminDonationRow, "status" | "fnReturned">) => DONATION_FILTER_LABEL[d.fnReturned && d.status === "REFUNDED" ? "FN_RETURNED" : d.status];
export type DonationsView = {
  rows: AdminDonationRow[];
  byStatus: Record<DonationFilter, { count: number; fn: number }>;
  byType: { typeLabel: string; count: number; fn: number }[];
};

// ── 확인 중 후원 (2026-10-08 결정) ────────────────────────────────────────────────

/**
 * A SOOP · FlexTV donation whose platform result was unknown (PENDING, FN held). The site re-checks it for 24 hours; after
 * that it is listed here (`waiting`) until 다시 확인 finds the result or an operator decides 성공 / 실패 (`resolved`).
 * 실패 returns the held FN — unless the sender's account has withdrawn since: then nothing is credited (`FORFEITED`).
 */
export type PendingDonationOutcome = "COMPLETED" | "FAILED";
export type PendingDonationRow = {
  transactionId: string;
  platform: "SOOP" | "FLEXTV";
  platformLabel: string;
  creatorName: string;
  productLabel: string;
  fnAmount: number;
  requestedAt: string;
  memberId: string;
  memberName: string;
  memberWithdrawn: boolean;
  lastCheckAt: string | null;
  resolution: {
    outcome: PendingDonationOutcome;
    at: string;
    by: "PLATFORM" | "OPERATOR";
    operator: string | null;
    note: string | null;
    fnReturn: "RETURNED" | "FORFEITED" | null;
    externalTransactionId: string | null;
  } | null;
};
/** `checking`: donations still inside their 24 h (the site re-checks them; not listed). */
export type PendingDonationsView = { waiting: PendingDonationRow[]; resolved: PendingDonationRow[]; checking: number };
/** 다시 확인 answers what the platform said (UNKNOWN = still no result). */
export type PendingCheckResult = { status: "OK"; outcome: PendingDonationOutcome | "UNKNOWN" } | Exclude<ActionResult, { status: "OK" }>;
export const RESOLVE_NOTE = { min: 2, max: 200 } as const;

// ── Settlements ───────────────────────────────────────────────────────────────

/**
 * FORFEITED = 탈퇴 소멸: the creator withdrew and agreed to forfeit earnings waiting for settlement.
 * PAID = 지급 완료: the operator recorded the transfer of an APPROVED request (2026-10-08 결정).
 */
export type SettlementStatus = "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "FORFEITED";
export const SETTLEMENT_STATUSES: SettlementStatus[] = ["PENDING", "APPROVED", "PAID", "REJECTED", "FORFEITED"];
/** Member type label and masked account only. */
export type AdminSettlementRegistration = { memberType: string; registrant: string; holder: string; bankName: string; accountMasked: string; code: string; submittedAt: string };
export type AdminSettlementRow = {
  id: string;
  /** The studio channel's name, or a withdrawn creator's original nickname (`creatorWithdrawn`: 탈퇴 badge). */
  creatorName: string;
  creatorWithdrawn: boolean;
  status: SettlementStatus;
  requestedAt: string;
  periodFrom: string;
  periodTo: string;
  amountFn: number;
  feeFn: number;
  netKrw: number;
  payoutDate: string | null;
  /** 정산 정보 at request time — what the request is reviewed and paid with. Null = the site refuses approval. */
  registrationAtRequest: AdminSettlementRegistration | null;
  review: { at: string; by: string; note: string } | null;
  /** 지급 완료: when, by whom, and the transfer reference (PAID only). */
  payment: { at: string; by: string; reference: string } | null;
  /** 보류 in force (심사 대기 · 승인 only): the site refuses 승인 · 반려 · 지급 완료 until 보류 해제. */
  hold: AdminHold | null;
};
/** 정산 심사 tabs: a status (requests on 보류 left out), or `HELD` = every request on 보류. */
export type SettlementFilter = SettlementStatus | "HELD";
export type AdminSettlementView = {
  rows: AdminSettlementRow[];
  /** Per status without the requests on 보류, which are counted in `held` (every request is in one tab). */
  counts: Record<SettlementStatus, number>;
  held: number;
  /** The creator's current registration (may differ from a request's `registrationAtRequest`). */
  registration: AdminSettlementRegistration | null;
  availableFn: number;
};
export const SETTLEMENT_NOTE = { min: 2, max: 200 } as const;
/** 이체 참조번호: letters, digits and hyphens; the site refuses one shaped like an account number. */
export const SETTLEMENT_REFERENCE = { min: 4, max: 40 } as const;

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
export const FAQ_LIMITS = { question: 120, answer: 1_000, linkLabel: 20, linkHref: 300 } as const;

// ── Platforms · system ────────────────────────────────────────────────────────

export type PlatformStatusRow = {
  platform: Platform;
  capabilities: PlatformCapability[];
  /** Declared for the mock but not confirmed against the real API yet (TBD). */
  unverified: PlatformCapability[];
  connection: { connected: boolean; channelTitle: string | null; lastSyncedAt: string | null; lastError: PlatformErrorCode | null; videoCount: number };
  donationLink: { enabled: boolean; received: number; duplicates: number; lastEventAt: string | null };
  lastCheck: { at: string; ok: boolean; latencyMs: number; error: PlatformErrorCode | null } | null;
};

export type SystemView = {
  banner: { enabled: boolean; level: "INFO" | "WARNING"; message: string; href: string | null; updatedAt: string | null; updatedBy: string | null };
  runtime: { mock: boolean; nodeEnv: string; auditEntries: number };
};
export const BANNER_MESSAGE_MAX = 120;
export const BANNER_HREF_MAX = 300;

// ── Reports (신고) ─────────────────────────────────────────────────────────────

export type ReportTargetType = "POST" | "COMMENT" | "CHANNEL_POST" | "MESSAGE" | "CREATOR";
export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = { POST: "커뮤니티 글", COMMENT: "댓글", CHANNEL_POST: "채널 커뮤니티 글", MESSAGE: "쪽지", CREATOR: "크리에이터 채널" };
export type ReportReason = "SPAM" | "ABUSE" | "SEXUAL" | "PRIVACY" | "IMPERSONATION" | "ETC";
export const REPORT_REASON_LABEL: Record<ReportReason, string> = { SPAM: "스팸 · 광고", ABUSE: "욕설 · 비하 · 혐오", SEXUAL: "음란 · 선정적 내용", PRIVACY: "개인정보 노출", IMPERSONATION: "사칭", ETC: "기타" };
export type ReportStatus = "OPEN" | "DISMISSED" | "ACTIONED";
export const REPORT_STATUSES: ReportStatus[] = ["OPEN", "DISMISSED", "ACTIONED"];
/** The reporter's member id and the content hash stay on the site. */
export type Report = {
  id: string;
  target: { type: ReportTargetType; id: string; parentId?: string };
  authorId: string;
  authorName: string;
  snapshot: string;
  reason: ReportReason;
  detail: string;
  reporterName: string;
  createdAt: string;
  status: ReportStatus;
  resolution: { at: string; by: string; action: "DISMISS" | "HIDE"; note: string } | null;
};
/**
 * `authorWithdrawn` / `reporterWithdrawn`: the member withdrew since (탈퇴 badge after the name at report time).
 * `contentChanged`: 신고 후 내용 변경됨 — the content changed since the report (the site compares; no hash is sent).
 */
export type AdminReportRow = Report & { authorIsMember: boolean; authorWithdrawn: boolean; reporterWithdrawn: boolean; contentChanged: boolean };
export type AdminReportView = { rows: AdminReportRow[]; counts: Record<ReportStatus, number> };
export const REPORT_NOTE = { min: 2, max: 200 } as const;

// ── Events (운영 › 이벤트, 2026-10-08 결정) ─────────────────────────────────────────

/**
 * One reward per event: FREE_FN = 참여자 전원 무상 FN (the amount the operator enters — no default), DRAW = 추첨 N명 경품
 * (the winner count and prize text the operator enters). After the event the site pays it (each participant's current
 * account, once, free FN) or draws the winners; people with no account are 지급 불가. 경품 고시 · 제세공과금 · 전달: TBD.
 */
export type EventPhase = "ongoing" | "upcoming" | "ended";
export const EVENT_PHASE_LABEL: Record<EventPhase, string> = { ongoing: "진행 중", upcoming: "예정", ended: "종료" };
export type EventReward = { kind: "FREE_FN"; amountFn: number } | { kind: "DRAW"; winners: number; prize: string };
/** Form bounds — the site's sanity limits, not business rules. */
export const EVENT_REWARD_LIMITS = { amountMaxFn: 10_000_000, winnersMax: 1_000, prizeMin: 2, prizeMax: 100 } as const;
export type AdminEventPerson = { memberId: string | null; name: string; withdrawn: boolean };
export type AdminEventResult =
  | { kind: "FREE_FN"; at: string; by: string; amountFn: number; totalFn: number; paid: AdminEventPerson[]; unpaid: AdminEventPerson[] }
  | { kind: "DRAW"; at: string; by: string; winnersWanted: number; prize: string; pool: number; winners: (AdminEventPerson & { masked: string })[]; unpaid: AdminEventPerson[] };
export type AdminEventRow = {
  id: string;
  title: string;
  emoji: string;
  startsAt: string;
  endsAt: string;
  phase: EventPhase;
  /** Recorded participants (people). */
  participants: number;
  /** The mock's sample count the site adds to its participant number — not people, never paid or drawn. */
  sampleParticipants: number;
  reward: (EventReward & { updatedAt: string; updatedBy: string }) | null;
  result: AdminEventResult | null;
};
export type AdminEventsView = { events: AdminEventRow[] };

// ── Mutation results ──────────────────────────────────────────────────────────

/**
 * Every write returns one of these (`id` for creates; NOT_FOUND / UNAUTHORIZED / UNAVAILABLE from the API; CONFLICT when
 * a create's request id was already used for a different draft).
 */
export type ActionResult = { status: "OK"; id?: string } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" | "UNAVAILABLE" | "CONFLICT" };
