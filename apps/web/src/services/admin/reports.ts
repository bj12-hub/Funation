import { USE_MOCK } from "@/lib/mock";
import { hideTarget, moderationStore } from "@/services/moderation/moderationCore";
import type { Report, ReportStatus } from "@/services/moderation/moderationTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { isWithdrawnMember } from "./memberCore";
import { memberIds } from "./members";

/**
 * 신고 처리 API logic — code-first (called by `/api/admin/reports*`). Admin app screen `/reports`.
 * An operator dismisses a report or hides the reported content; both are final and audited. Other open
 * reports on the same content are closed with it (a dismissal: those on the same version of it). Sanctions on the author
 * go through 회원 관리.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin report API is not connected yet.");
};
const STATUSES: ReportStatus[] = ["OPEN", "DISMISSED", "ACTIONED"];
export const REPORT_NOTE = { min: 2, max: 200 } as const;

/**
 * A report as the console shows it: the reporter's member id and the content hash stay on the server. Names are the ones
 * at report time; `authorWithdrawn` / `reporterWithdrawn` mark a member who withdrew since (shown with a 탈퇴 badge,
 * 2026-10-08 결정 — also after a 재가입 moved the report to `…-wN`).
 */
export type AdminReportRow = Omit<Report, "reporterId" | "contentHash"> & { authorIsMember: boolean; authorWithdrawn: boolean; reporterWithdrawn: boolean };
export type AdminReportView = { rows: AdminReportRow[]; counts: Record<ReportStatus, number> };
export type ReportDecisionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" };

export async function listReports(input: { status?: unknown } = {}): Promise<AdminReportView> {
  assertMock();
  const all = moderationStore().reports;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((r) => r.status === s).length])) as AdminReportView["counts"];
  const status = STATUSES.includes(input.status as ReportStatus) ? (input.status as ReportStatus) : "OPEN";
  const members = await memberIds();
  const rows = all
    .filter((r) => r.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(
      (r): AdminReportRow => ({
        id: r.id,
        target: { ...r.target },
        authorId: r.authorId,
        authorName: r.authorName,
        snapshot: r.snapshot,
        reason: r.reason,
        detail: r.detail,
        reporterName: r.reporterName,
        createdAt: r.createdAt,
        status: r.status,
        resolution: r.resolution ? { ...r.resolution } : null,
        authorIsMember: members.has(r.authorId),
        authorWithdrawn: isWithdrawnMember(r.authorId),
        reporterWithdrawn: isWithdrawnMember(r.reporterId)
      })
    );
  return { rows, counts };
}

export async function decideReport(admin: AdminActor, input: unknown): Promise<ReportDecisionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const report = moderationStore().reports.find((r) => r.id === v.id);
  if (!report) return { status: "NOT_FOUND" };
  if (v.action !== "DISMISS" && v.action !== "HIDE") return { status: "INVALID", message: "처리 방법을 골라 주세요." };
  const note = typeof v.note === "string" ? v.note.trim() : "";
  if (note.length < REPORT_NOTE.min || note.length > REPORT_NOTE.max) return { status: "INVALID", message: `처리 메모를 ${REPORT_NOTE.min}~${REPORT_NOTE.max}자로 입력해 주세요.` };
  const wanted = v.action === "HIDE" ? "ACTIONED" : "DISMISSED";
  if (report.status !== "OPEN") return report.status === wanted ? { status: "OK" } : { status: "INVALID", message: "이미 처리된 신고예요." };
  if (v.action === "HIDE" && report.target.type === "CREATOR") return { status: "INVALID", message: "크리에이터 채널은 숨길 수 없어요. 회원 관리에서 이용 정지로 처리해 주세요." };
  if (v.action === "HIDE") hideTarget(report.target);
  const resolution = { at: new Date().toISOString(), by: admin.nickname, action: v.action, note } as const;
  // Every open report on the same content is settled by one decision, and each one it closes is audited. Hiding removes
  // the content, so it closes them all; a dismissal covers only what the operator saw — reports filed on another
  // version of the content (it changed in between, contentHash) stay open for their own review.
  const sameTarget = (r: Report) => r.target.type === report.target.type && r.target.id === report.target.id && r.target.parentId === report.target.parentId;
  const covered = (r: Report) => sameTarget(r) && (v.action === "HIDE" || r.contentHash === report.contentHash);
  for (const r of moderationStore().reports.filter((x) => x.status === "OPEN" && covered(x))) {
    r.status = wanted;
    r.resolution = { ...resolution };
    const reason = r.id === report.id ? note : `${note} (신고 ${report.id} 처리로 함께 종료)`;
    recordAudit(admin, v.action === "HIDE" ? "REPORT_HIDE" : "REPORT_DISMISS", `report:${r.id}`, reason);
  }
  return { status: "OK" };
}
