import { USE_MOCK } from "@/lib/mock";
import { mockAccount } from "@/services/account/mockStore";
import { getAllCreatorsForAdmin } from "@/services/creators/creators";
import { listDonationRecords } from "@/services/wallet/walletHistory";
import type { AuditEntry } from "./adminTypes";
import type { AdminActor } from "./adminTypes";
import { auditEntries, recordAudit } from "./auditCore";
import { SAMPLE_MEMBER_ID, creatorMemberId, isMemberSuspended, memberStore, suspensionOf } from "./memberCore";
import { MEMBERS_PAGE, SUSPEND_DAYS, SUSPEND_REASON, type AdminCreatorRow, type AdminMember, type MemberActionResult, type MemberFilter, type MemberPage } from "./memberTypes";

/**
 * 회원 · 크리에이터 관리 API logic — code-first (called by `/api/admin/*`). Admin app screens `/admin/members`, `/admin/members/[id]`,
 * `/admin/creators`. Admin only; every suspend / restore needs a reason and is written to the audit log.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin member API is not connected yet.");
};

async function directory(): Promise<AdminMember[]> {
  const now = Date.now();
  const status = (id: string) => (isMemberSuspended(id, now) ? "SUSPENDED" : "ACTIVE") as AdminMember["status"];
  const withStatus = (m: Omit<AdminMember, "status" | "suspension">): AdminMember => ({ ...m, status: status(m.id), suspension: isMemberSuspended(m.id, now) ? suspensionOf(m.id) : null });
  const sample = withStatus({
    id: SAMPLE_MEMBER_ID,
    nickname: mockAccount.nickname,
    funationId: mockAccount.funationId,
    roles: ["SUPPORTER", "CREATOR"],
    joinedAt: "2025-11-02",
    lastActiveAt: new Date(now).toISOString().slice(0, 10),
    fnBalance: mockAccount.fnBalance,
    donationTotalFn: listDonationRecords().filter((d) => d.status === "COMPLETED").reduce((s, d) => s + d.fnAmount, 0),
    creatorId: null
  });
  const creators = (await getAllCreatorsForAdmin()).map((c) =>
    withStatus({ id: creatorMemberId(c.id), nickname: c.name, funationId: `creator-${c.id}`, roles: ["SUPPORTER", "CREATOR"], joinedAt: c.joinedAt, lastActiveAt: c.joinedAt, fnBalance: 0, donationTotalFn: 0, creatorId: c.id })
  );
  const supporters = memberStore().supporters.map((s) => withStatus({ ...s, roles: ["SUPPORTER"], creatorId: null }));
  return [sample, ...creators, ...supporters];
}

const parseFilter = (input: Record<string, unknown>): MemberFilter => ({
  q: typeof input.q === "string" ? input.q.trim().slice(0, 40) : "",
  role: input.role === "SUPPORTER" || input.role === "CREATOR" ? input.role : "ALL",
  status: input.status === "ACTIVE" || input.status === "SUSPENDED" ? input.status : "ALL",
  page: Math.max(1, Math.floor(Number(input.page)) || 1)
});

export async function listMembers(input: Record<string, unknown> = {}): Promise<MemberPage | null> {
  assertMock();
  const filter = parseFilter(input);
  const q = filter.q.toLowerCase();
  const all = (await directory()).filter(
    (m) =>
      (!q || m.nickname.toLowerCase().includes(q) || m.funationId.toLowerCase().includes(q) || m.id === filter.q) &&
      (filter.role === "ALL" || (filter.role === "CREATOR" ? m.roles.includes("CREATOR") : !m.roles.includes("CREATOR"))) &&
      (filter.status === "ALL" || m.status === filter.status)
  );
  const totalPages = Math.max(1, Math.ceil(all.length / MEMBERS_PAGE));
  const page = Math.min(filter.page, totalPages);
  return { items: all.slice((page - 1) * MEMBERS_PAGE, page * MEMBERS_PAGE), total: all.length, page, totalPages, filter: { ...filter, page } };
}

export async function getMemberDetail(id: unknown): Promise<{ member: AdminMember; audit: AuditEntry[] } | null> {
  assertMock();
  const member = (await directory()).find((m) => m.id === id);
  if (!member) return null;
  return { member, audit: auditEntries().filter((e) => e.target === `member:${member.id}`) };
}

export async function suspendMember(admin: AdminActor, input: unknown): Promise<MemberActionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const store = memberStore();
  if (store.requests[v.requestId]) return { status: "OK" };
  const member = (await directory()).find((m) => m.id === v.id);
  if (!member) return { status: "NOT_FOUND" };
  const reason = typeof v.reason === "string" ? v.reason.trim() : "";
  if (reason.length < SUSPEND_REASON.min || reason.length > SUSPEND_REASON.max) return { status: "INVALID", message: `사유를 ${SUSPEND_REASON.min}~${SUSPEND_REASON.max}자로 입력해 주세요.` };
  if (!SUSPEND_DAYS.includes(v.days as never)) return { status: "INVALID", message: "정지 기간을 골라 주세요." };
  if (member.status === "SUSPENDED") return { status: "INVALID", message: "이미 정지된 회원이에요." };
  const now = Date.now();
  store.suspensions[member.id] = { reason, at: new Date(now).toISOString(), until: v.days === null ? null : new Date(now + (v.days as number) * 86_400_000).toISOString(), by: admin.nickname };
  store.requests[v.requestId] = true;
  recordAudit(admin, "MEMBER_SUSPEND", `member:${member.id}`, `${v.days === null ? "무기한" : `${v.days}일`} · ${reason}`);
  return { status: "OK" };
}

export async function restoreMember(admin: AdminActor, input: unknown): Promise<MemberActionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const member = (await directory()).find((m) => m.id === v.id);
  if (!member) return { status: "NOT_FOUND" };
  const reason = typeof v.reason === "string" ? v.reason.trim() : "";
  if (reason.length < SUSPEND_REASON.min || reason.length > SUSPEND_REASON.max) return { status: "INVALID", message: `사유를 ${SUSPEND_REASON.min}~${SUSPEND_REASON.max}자로 입력해 주세요.` };
  // Idempotent: restoring an active member changes nothing and writes no log.
  if (member.status !== "SUSPENDED") return { status: "OK" };
  delete memberStore().suspensions[member.id];
  recordAudit(admin, "MEMBER_RESTORE", `member:${member.id}`, reason);
  return { status: "OK" };
}

export async function listAdminCreators(input: { q?: unknown } = {}): Promise<AdminCreatorRow[] | null> {
  assertMock();
  const q = typeof input.q === "string" ? input.q.trim().toLowerCase() : "";
  return (await getAllCreatorsForAdmin())
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.id === q)
    .map((c) => ({ creatorId: c.id, name: c.name, memberId: creatorMemberId(c.id), isLive: c.isLive, subscriberCount: c.subscriberCount, joinedAt: c.joinedAt, status: isMemberSuspended(creatorMemberId(c.id)) ? "SUSPENDED" : "ACTIVE" }));
}
