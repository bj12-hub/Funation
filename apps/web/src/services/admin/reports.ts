import { USE_MOCK } from "@/lib/mock";
import { hideTarget, moderationStore } from "@/services/moderation/moderationCore";
import type { Report, ReportStatus } from "@/services/moderation/moderationTypes";
import type { AdminActor } from "./adminTypes";
import { recordAudit } from "./auditCore";
import { memberIds } from "./members";

/**
 * 신고 처리 API logic — code-first (called by `/api/admin/reports*`). Admin app screen `/reports`.
 * An operator dismisses a report or hides the reported content; both are final and audited. Other open
 * reports on the same content are closed with it. Sanctions on the author go through 회원 관리.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin report API is not connected yet.");
};
const STATUSES: ReportStatus[] = ["OPEN", "DISMISSED", "ACTIONED"];
export const REPORT_NOTE = { min: 2, max: 200 } as const;

export type AdminReportView = { rows: (Report & { authorIsMember: boolean })[]; counts: Record<ReportStatus, number> };
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
    .map((r) => ({ ...structuredClone(r), authorIsMember: members.has(r.authorId) }));
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
  // Every open report on the same content is settled by one decision.
  const sameTarget = (r: Report) => r.target.type === report.target.type && r.target.id === report.target.id && r.target.parentId === report.target.parentId;
  for (const r of moderationStore().reports.filter((x) => x.status === "OPEN" && sameTarget(x))) {
    r.status = wanted;
    r.resolution = { ...resolution };
  }
  recordAudit(admin, v.action === "HIDE" ? "REPORT_HIDE" : "REPORT_DISMISS", `report:${report.id}`, note);
  return { status: "OK" };
}
