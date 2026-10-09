import { toDateString } from "@/lib/period";
import { USE_MOCK } from "@/lib/mock";
import { ownEntry } from "@/lib/records";
import { mockAccount } from "@/services/account/mockStore";
import { getAllCreatorsForAdmin } from "@/services/creators/creators";
import { mockFnSettlements, type MockFnSettlement } from "@/services/wallet/mockFnSettlementStore";
import { mockRefunds } from "@/services/wallet/mockRefundStore";
import { remainingFnPlan } from "@/services/wallet/refundCore";
import type { ChargeRefundLine } from "@/services/wallet/refundPolicy";
import { listAccountDonationRecords } from "@/services/wallet/walletHistory";
import type { AuditEntry } from "./adminTypes";
import type { AdminActor } from "./adminTypes";
import { auditEntries, recordAudit } from "./auditCore";
import { activeHold } from "./holdCore";
import { SAMPLE_MEMBER_ID, creatorMemberId, isMemberSuspended, isPermanentlySuspended, isWithdrawnMember, memberStore, slotMemberAt, suspensionOf, withdrawnMemberId } from "./memberCore";
import { accountSince, withdrawalOf, withdrawalStore, type Withdrawal } from "@/services/account/withdrawalCore";
import { RETENTION_DEFAULTS_LABEL, retentionRule, retentionSchedule } from "@/services/account/retentionPolicy";
import { purgeExpired } from "@/services/account/retentionPurge";
import {
  ADMIN_QUERY_MAX,
  FN_SETTLE_NOTE,
  MEMBERS_PAGE,
  SUSPEND_DAYS,
  SUSPEND_REASON,
  type AdminCreatorRow,
  type AdminMember,
  type MemberActionResult,
  type MemberFilter,
  type MemberFnSettlement,
  type MemberPage,
  type MemberRetention
} from "./memberTypes";

/**
 * 회원 · 크리에이터 관리 API logic — code-first (called by `/api/admin/*`). Admin app screens `/admin/members`, `/admin/members/[id]`,
 * `/admin/creators`. Admin only; every suspend / restore needs a reason and is written to the audit log.
 *
 * 이용 정지 and FN (2026-10-08 결정): a suspended member keeps their FN — they cannot use them while suspended (no session)
 * and can again once the suspension is lifted. A 영구 정지 member cannot sign in, so on request an operator settles the
 * remaining FN (남은 FN 정리, `settleMemberFn`): paid FN refunded per charge under the 환불 정책 기본값, free FN forfeited.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Admin member API is not connected yet.");
};

/** 탈퇴 회원 정보 보관 (account/retentionPolicy.ts, 기본값): until when each category of the account's data is kept. */
const retentionOf = (w: Withdrawal): MemberRetention[] =>
  retentionSchedule(w.at).map(({ category, until }) => {
    const rule = retentionRule(category);
    return { category, label: rule.label, period: rule.period, basis: rule.basis, covers: rule.covers, until, purged: w.purged.includes(category) };
  });

async function directory(): Promise<AdminMember[]> {
  // Data past its retention date goes before anything is shown (the purge runs lazily on reads).
  purgeExpired();
  const now = Date.now();
  const status = (id: string) => (isMemberSuspended(id, now) ? "SUSPENDED" : "ACTIVE") as AdminMember["status"];
  const withStatus = (m: Omit<AdminMember, "status" | "suspension" | "withdrawal">): AdminMember => ({
    ...m,
    status: status(m.id),
    suspension: isMemberSuspended(m.id, now) ? suspensionOf(m.id) : null,
    withdrawal: null
  });
  const withdrawal = withdrawalOf();
  // Completed donations per slot account (start marker): each account, withdrawn ones too, totals only its own.
  const donated = listAccountDonationRecords().filter((d) => d.status === "COMPLETED");
  const donatedBy = (account: string | null) => donated.filter((d) => d.account === account).reduce((s, d) => s + d.fnAmount, 0);
  const active = withStatus({
    id: SAMPLE_MEMBER_ID,
    nickname: mockAccount.nickname,
    ssumnationId: mockAccount.ssumnationId,
    roles: ["SUPPORTER", "CREATOR"],
    joinedAt: "2025-11-02",
    lastActiveAt: new Date(now).toISOString().slice(0, 10),
    fnBalance: mockAccount.fnBalance,
    donationTotalFn: donatedBy(accountSince()),
    creatorId: null
  });
  const record = (w: Withdrawal): AdminMember["withdrawal"] => ({
    at: w.at,
    forfeitedFn: w.forfeitedFn,
    forfeitedEarningsFn: w.forfeitedEarningsFn,
    retentionNote: RETENTION_DEFAULTS_LABEL,
    retention: retentionOf(w)
  });
  // A withdrawn account is listed while its 탈퇴 기록 is kept (계약 기록, 5년 — 기본값); after that it is gone.
  const listed = (w: Withdrawal) => !w.purged.includes("CONTRACT");
  // 회원 탈퇴: the sample member stays listed as 탈퇴 with what was forfeited.
  const sample: AdminMember | null = withdrawal ? (listed(withdrawal) ? { ...active, status: "WITHDRAWN", suspension: null, withdrawal: record(withdrawal) } : null) : active;
  // After a 재가입 the slot is a new account; the withdrawn ones stay in the directory (mock ids `…-w1`, `…-w2`).
  const withdrawn = withdrawalStore().past.flatMap((w, i): AdminMember[] =>
    listed(w)
      ? [
          {
            ...active,
            id: withdrawnMemberId(i + 1),
            nickname: w.nickname,
            ssumnationId: w.ssumnationId,
            lastActiveAt: w.at.slice(0, 10),
            fnBalance: 0,
            donationTotalFn: donatedBy(w.accountSince),
            status: "WITHDRAWN",
            suspension: null,
            withdrawal: record(w)
          }
        ]
      : []
  );
  const creators = (await getAllCreatorsForAdmin()).map((c) =>
    withStatus({ id: creatorMemberId(c.id), nickname: c.name, ssumnationId: `creator-${c.id}`, roles: ["SUPPORTER", "CREATOR"], joinedAt: c.joinedAt, lastActiveAt: c.joinedAt, fnBalance: 0, donationTotalFn: 0, creatorId: c.id })
  );
  const supporters = memberStore().supporters.map((s) => withStatus({ ...s, roles: ["SUPPORTER"], creatorId: null }));
  return [...(sample ? [sample] : []), ...withdrawn, ...creators, ...supporters];
}

/** Nickname and 탈퇴 state of every member in the directory, by id (감사 로그 names the members it links to). */
export async function memberLabels(): Promise<Map<string, { name: string; withdrawn: boolean }>> {
  return new Map((await directory()).map((m) => [m.id, { name: m.nickname, withdrawn: m.status === "WITHDRAWN" }]));
}

/** Ids present in the member directory (reports link to 회원 상세 only for these). */
export async function memberIds(): Promise<Set<string>> {
  return new Set((await directory()).map((m) => m.id));
}

/** The search text of 회원 관리 and 크리에이터 관리: trimmed and capped at ADMIN_QUERY_MAX. */
export const adminSearchQuery = (q: unknown) => (typeof q === "string" ? q.trim().slice(0, ADMIN_QUERY_MAX) : "");

const parseFilter = (input: Record<string, unknown>): MemberFilter => ({
  q: adminSearchQuery(input.q),
  role: input.role === "SUPPORTER" || input.role === "CREATOR" ? input.role : "ALL",
  status: input.status === "ACTIVE" || input.status === "SUSPENDED" || input.status === "WITHDRAWN" ? input.status : "ALL",
  page: Math.max(1, Math.floor(Number(input.page)) || 1)
});

export async function listMembers(input: Record<string, unknown> = {}): Promise<MemberPage | null> {
  assertMock();
  const filter = parseFilter(input);
  const q = filter.q.toLowerCase();
  const all = (await directory()).filter(
    (m) =>
      (!q || m.nickname.toLowerCase().includes(q) || m.ssumnationId.toLowerCase().includes(q) || m.id === filter.q) &&
      (filter.role === "ALL" || (filter.role === "CREATOR" ? m.roles.includes("CREATOR") : !m.roles.includes("CREATOR"))) &&
      (filter.status === "ALL" || m.status === filter.status)
  );
  const totalPages = Math.max(1, Math.ceil(all.length / MEMBERS_PAGE));
  const page = Math.min(filter.page, totalPages);
  return { items: all.slice((page - 1) * MEMBERS_PAGE, page * MEMBERS_PAGE), total: all.length, page, totalPages, filter: { ...filter, page } };
}

export async function getMemberDetail(id: unknown): Promise<{ member: AdminMember; audit: AuditEntry[]; fnSettlement: MemberFnSettlement | null } | null> {
  assertMock();
  const member = (await directory()).find((m) => m.id === id);
  if (!member) return null;
  // Entries filed under the slot id before a 재가입 are the withdrawn account's (`…-wN`), not the new account's.
  const about = (e: AuditEntry) => (e.target === `member:${SAMPLE_MEMBER_ID}` ? `member:${slotMemberAt(e.at)}` : e.target);
  return { member, audit: auditEntries().filter((e) => about(e) === `member:${member.id}`), fnSettlement: fnSettlementOf(member, new Date()) };
}

export async function suspendMember(admin: AdminActor, input: unknown): Promise<MemberActionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const store = memberStore();
  if (ownEntry(store.requests, v.requestId)) return { status: "OK" };
  const member = (await directory()).find((m) => m.id === v.id);
  if (!member) return { status: "NOT_FOUND" };
  const reason = typeof v.reason === "string" ? v.reason.trim() : "";
  if (reason.length < SUSPEND_REASON.min || reason.length > SUSPEND_REASON.max) return { status: "INVALID", message: `사유를 ${SUSPEND_REASON.min}~${SUSPEND_REASON.max}자로 입력해 주세요.` };
  if (!SUSPEND_DAYS.includes(v.days as never)) return { status: "INVALID", message: "정지 기간을 골라 주세요." };
  // Read again after the directory's await, in one synchronous step with the write: the same request arriving twice
  // (double click, retry), another operator's suspension or a 탈퇴 meanwhile must not be overwritten or logged twice.
  if (ownEntry(store.requests, v.requestId)) return { status: "OK" };
  if (isMemberSuspended(member.id)) return { status: "INVALID", message: "이미 정지된 회원이에요." };
  if (isWithdrawnMember(member.id)) return { status: "INVALID", message: "탈퇴한 회원이에요." };
  const now = Date.now();
  store.suspensions[member.id] = { reason, at: new Date(now).toISOString(), until: v.days === null ? null : new Date(now + (v.days as number) * 86_400_000).toISOString(), by: admin.nickname };
  store.requests[v.requestId] = true;
  recordAudit(admin, "MEMBER_SUSPEND", `member:${member.id}`, `${v.days === null ? "영구" : `${v.days}일`} · ${reason}`);
  return { status: "OK" };
}

export async function restoreMember(admin: AdminActor, input: unknown): Promise<MemberActionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const member = (await directory()).find((m) => m.id === v.id);
  if (!member) return { status: "NOT_FOUND" };
  const reason = typeof v.reason === "string" ? v.reason.trim() : "";
  if (reason.length < SUSPEND_REASON.min || reason.length > SUSPEND_REASON.max) return { status: "INVALID", message: `사유를 ${SUSPEND_REASON.min}~${SUSPEND_REASON.max}자로 입력해 주세요.` };
  // Idempotent: restoring an active member changes nothing and writes no log. Read now, after the await, so the same
  // restore arriving twice at once is logged once.
  if (isWithdrawnMember(member.id) || !isMemberSuspended(member.id)) return { status: "OK" };
  delete memberStore().suspensions[member.id];
  recordAudit(admin, "MEMBER_RESTORE", `member:${member.id}`, reason);
  return { status: "OK" };
}

// ── 남은 FN 정리 (영구 정지, 2026-10-08 결정) ─────────────────────────────────────

const REQUEST_ID = /^[A-Za-z0-9-]{16,64}$/;
const fnText = (n: number) => `${n.toLocaleString("ko-KR")} FN`;
const wonText = (n: number) => `${n.toLocaleString("ko-KR")}원`;
const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const line = (l: ChargeRefundLine): ChargeRefundLine => ({
  chargeId: l.chargeId,
  chargedAt: l.chargedAt,
  methodLabel: l.methodLabel,
  chargeFn: l.chargeFn,
  paidKrw: l.paidKrw,
  type: l.type,
  grossFn: l.grossFn,
  feeFn: l.feeFn,
  netFn: l.netFn,
  refundKrw: l.refundKrw
});
const totalOf = (lines: ChargeRefundLine[]) =>
  lines.reduce((t, l) => ({ grossFn: t.grossFn + l.grossFn, feeFn: t.feeFn + l.feeFn, netFn: t.netFn + l.netFn, refundKrw: t.refundKrw + l.refundKrw }), { grossFn: 0, feeFn: 0, netFn: 0, refundKrw: 0 });
/** "환불 2건 · 회수 12,500 FN · 수수료 750 FN · 환불 11,750 FN · 12,925원 · 무상 FN 소멸 300 FN" (audit log and answers). */
const settlementText = (lines: ChargeRefundLine[], forfeitFn: number) => {
  const t = totalOf(lines);
  const refund = lines.length > 0 ? `환불 ${lines.length}건 · 회수 ${fnText(t.grossFn)} · 수수료 ${fnText(t.feeFn)} · 환불 ${fnText(t.netFn)} · ${wonText(t.refundKrw)}` : "환불할 유상 FN 없음";
  return `${refund} · 무상 FN 소멸 ${fnText(forfeitFn)}`;
};

/**
 * Why 남은 FN 정리 waits (2026-10-08 결정, consistent with 보류 #287): a refund request of the account still on 보류 or
 * waiting for 승인 · 거절 would be decided against FN the settlement already took back, so it is decided first.
 */
function settlementBlock(): string | null {
  const open = mockRefunds.requests.filter((r) => r.status === "REQUESTED" && r.accountSince === accountSince());
  if (open.some((r) => activeHold(r.holds))) return "보류 중인 환불 요청이 있어 남은 FN을 정리할 수 없어요. 결제 · 환불에서 보류를 해제하고 그 요청을 먼저 처리해 주세요.";
  if (open.length > 0) return "심사 대기 중인 환불 요청이 있어 남은 FN을 정리할 수 없어요. 결제 · 환불에서 그 요청을 먼저 승인 · 거절해 주세요.";
  return null;
}

const ownSettlements = (memberId: string) => mockFnSettlements.settlements.filter((s) => s.memberId === memberId && s.accountSince === accountSince());

/**
 * 남은 FN 정리 of a 영구 정지 member, as it would run at `now` (null for anyone else). Nothing awaits: `settleMemberFn`
 * checks and writes with it in one synchronous step. The mock keeps a wallet ledger for the sample member only.
 */
function fnSettlementOf(member: AdminMember, now: Date): MemberFnSettlement | null {
  if (isWithdrawnMember(member.id) || !isPermanentlySuspended(member.id, now.getTime())) return null;
  const history = ownSettlements(member.id)
    .reverse()
    .map((s) => ({ at: s.at, by: s.by, note: s.note, lines: s.lines.map(line), forfeitFn: s.forfeitFn }));
  if (member.id !== SAMPLE_MEMBER_ID) {
    return { status: "NO_LEDGER", blocked: null, balanceFn: member.fnBalance, lines: [], total: totalOf([]), forfeitFn: 0, history };
  }
  const plan = remainingFnPlan(now);
  const lines = plan.lines.map(line);
  const blocked = plan.balanceFn > 0 ? settlementBlock() : null;
  const status = plan.balanceFn <= 0 ? "EMPTY" : blocked ? "BLOCKED" : "READY";
  return { status, blocked, balanceFn: plan.balanceFn, lines, total: totalOf(lines), forfeitFn: plan.forfeitFn, history };
}

/**
 * 남은 FN 정리 (2026-10-08 결정): `{ id, note, requestId, expectedGrossFn, expectedNetFn, expectedRefundKrw,
 * expectedForfeitFn }` for a 영구 정지 member, who cannot sign in — an operator processes it on the member's request.
 * Each charge's unused paid FN are refunded under the 환불 정책 기본값 (its refund recorded in the wallet history), the
 * free FN are forfeited, the balance goes to 0 and the audit log gets `MEMBER_FN_SETTLE`. The operator confirms the
 * amounts the console showed; when they changed (a charge's 청약철회 period ended, FN came back) nothing is written.
 * One console request id per 정리: the same id with the same member, memo and amounts answers OK without a second change
 * or log entry; anything else under that id is refused. Refused for a member who is not 영구 정지, has nothing to settle,
 * or has a refund request waiting or on 보류. KRW payout per payment method is TBD (payment provider).
 */
export async function settleMemberFn(admin: AdminActor, input: unknown): Promise<MemberActionResult> {
  assertMock();
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !REQUEST_ID.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const requestId = v.requestId;
  const note = typeof v.note === "string" ? v.note.trim() : "";
  const expected = [v.expectedGrossFn, v.expectedNetFn, v.expectedRefundKrw, v.expectedForfeitFn];
  // A retry is the same member, memo and confirmed amounts (what the 정리 recorded); anything else under that id was
  // never processed, so it is refused rather than answered OK.
  const retry = (s: MockFnSettlement): MemberActionResult => {
    const t = totalOf(s.lines);
    const recordedAmounts = [t.grossFn, t.netFn, t.refundKrw, s.forfeitFn];
    const same = s.memberId === v.id && s.note === note && expected.every((n, i) => n === recordedAmounts[i]);
    return same ? { status: "OK" } : { status: "INVALID", message: "잘못된 요청입니다." };
  };
  const recorded = () => mockFnSettlements.settlements.find((s) => s.requestId === requestId);
  const done = recorded();
  if (done) return retry(done);
  if (note.length < FN_SETTLE_NOTE.min || note.length > FN_SETTLE_NOTE.max) return { status: "INVALID", message: `처리 메모를 ${FN_SETTLE_NOTE.min}~${FN_SETTLE_NOTE.max}자로 입력해 주세요.` };
  if (!expected.every(isAmount)) return { status: "INVALID", message: "정리할 금액을 확인해 주세요. 화면을 새로 고친 뒤 다시 처리해 주세요." };
  const member = (await directory()).find((m) => m.id === v.id);
  if (!member) return { status: "NOT_FOUND" };

  // From here to the write nothing awaits: the retry check, the policy and the balance change see the same state.
  const again = recorded();
  if (again) return retry(again);
  const now = new Date();
  if (isWithdrawnMember(member.id)) return { status: "INVALID", message: "탈퇴한 회원이에요." };
  const plan = fnSettlementOf(member, now);
  if (!plan) return { status: "INVALID", message: "영구 정지된 회원만 남은 FN을 정리할 수 있어요." };
  if (plan.status === "NO_LEDGER") return { status: "INVALID", message: "이 회원의 지갑 기록이 없어 남은 FN을 정리할 수 없어요. (목업은 샘플 회원만 지갑 기록이 있어요.)" };
  if (plan.status === "EMPTY") return { status: "INVALID", message: "정리할 FN이 없어요." };
  if (plan.status === "BLOCKED") return { status: "INVALID", message: plan.blocked ?? "지금은 남은 FN을 정리할 수 없어요." };
  const current = [plan.total.grossFn, plan.total.netFn, plan.total.refundKrw, plan.forfeitFn];
  if (expected.some((n, i) => n !== current[i])) {
    return { status: "INVALID", message: `정리할 금액이 바뀌었어요. 지금 기준(${settlementText(plan.lines, plan.forfeitFn)})으로만 처리할 수 있어요. 확인한 뒤 다시 처리해 주세요.` };
  }
  mockAccount.fnBalance -= plan.total.grossFn + plan.forfeitFn;
  mockFnSettlements.settlements.push({
    id: `fs-${globalThis.crypto.randomUUID()}`,
    requestId,
    memberId: member.id,
    accountSince: accountSince(),
    at: now.toISOString(),
    ledgerAt: `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`,
    by: admin.nickname,
    note,
    balanceFn: plan.balanceFn,
    lines: plan.lines,
    forfeitFn: plan.forfeitFn
  });
  recordAudit(admin, "MEMBER_FN_SETTLE", `member:${member.id}`, `${settlementText(plan.lines, plan.forfeitFn)} · ${note}`);
  return { status: "OK" };
}

export async function listAdminCreators(input: { q?: unknown } = {}): Promise<AdminCreatorRow[] | null> {
  assertMock();
  const q = adminSearchQuery(input.q).toLowerCase();
  return (await getAllCreatorsForAdmin())
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.id === q)
    .map((c) => ({ creatorId: c.id, name: c.name, memberId: creatorMemberId(c.id), isLive: c.isLive, subscriberCount: c.subscriberCount, joinedAt: c.joinedAt, status: isMemberSuspended(creatorMemberId(c.id)) ? "SUSPENDED" : "ACTIVE" }));
}
