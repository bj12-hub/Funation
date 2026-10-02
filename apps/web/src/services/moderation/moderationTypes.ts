/**
 * 신고 · 차단 — code-first. Client-safe types. The reason list is a UX taxonomy; what each reason means
 * for enforcement (sanctions, thresholds, appeal) is policy and TBD.
 */

export type ReportTargetType = "POST" | "COMMENT" | "CHANNEL_POST" | "MESSAGE" | "CREATOR";

export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = { POST: "커뮤니티 글", COMMENT: "댓글", CHANNEL_POST: "채널 커뮤니티 글", MESSAGE: "쪽지", CREATOR: "크리에이터 채널" };

export const REPORT_REASONS = [
  { key: "SPAM", label: "스팸 · 광고" },
  { key: "ABUSE", label: "욕설 · 비하 · 혐오" },
  { key: "SEXUAL", label: "음란 · 선정적 내용" },
  { key: "PRIVACY", label: "개인정보 노출" },
  { key: "IMPERSONATION", label: "사칭" },
  { key: "ETC", label: "기타" }
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

export const REPORT_DETAIL_MAX = 300;

/** Points at the reported content; `parentId` is the post of a comment. */
export type ReportTarget = { type: ReportTargetType; id: string; parentId?: string };

export type ReportStatus = "OPEN" | "DISMISSED" | "ACTIONED";

export type Report = {
  id: string;
  target: ReportTarget;
  /** Snapshot at report time, so the evidence survives edits and deletion. */
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

export type BlockEntry = { id: string; name: string; since: string };

export type ReportResult = { status: "REPORTED" | "ALREADY_REPORTED" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
export type BlockResult = { status: "OK"; name: string } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };
