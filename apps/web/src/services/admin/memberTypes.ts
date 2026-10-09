import type { RetentionCategory } from "@/services/account/retentionPolicy";
import type { ChargeRefundLine } from "@/services/wallet/refundPolicy";
import type { Role } from "@/types/role";

/**
 * 회원 · 크리에이터 관리 — code-first. Client-safe types. Durations are operator choices; grounds and appeal are TBD.
 * Decided 2026-10-08: settlements and charge refunds go on as usual during a suspension, and a suspended member keeps
 * their FN (unusable while suspended — no session — and usable again once it is lifted); a 영구 정지 member's remaining
 * FN are settled by an operator on request (남은 FN 정리, `MemberFnSettlement`).
 */

/** WITHDRAWN = 회원 탈퇴 (2026-10-04 결정); the record stays for audit. */
export type MemberStatus = "ACTIVE" | "SUSPENDED" | "WITHDRAWN";

export type Suspension = { reason: string; at: string; until: string | null; by: string };

/**
 * 탈퇴 회원 정보 보관 (account/retentionPolicy.ts — 기본값, 법무 검토 전): one row of the shared list with this
 * account's date. `until`: ISO time the category's data goes (null = 삭제하지 않음); `purged`: it has gone.
 */
export type MemberRetention = {
  category: RetentionCategory;
  label: string;
  period: string;
  basis: string;
  covers: string;
  until: string | null;
  purged: boolean;
};

export type AdminMember = {
  id: string;
  nickname: string;
  ssumnationId: string;
  roles: Role[];
  joinedAt: string;
  lastActiveAt: string;
  status: MemberStatus;
  suspension: Suspension | null;
  /**
   * 회원 탈퇴: when, the FN and creator earnings (정산 대기 수익) the member agreed to forfeit, and until when each
   * category of the account's data is kept (`retentionNote`: how the periods are labelled — 기본값).
   */
  withdrawal: { at: string; forfeitedFn: number; forfeitedEarningsFn: number; retentionNote: string; retention: MemberRetention[] } | null;
  /** Server-side values (mock: only the sample member has real wallet data). */
  fnBalance: number;
  donationTotalFn: number;
  creatorId: string | null;
};

export type MemberFilter = { q: string; role: "ALL" | "SUPPORTER" | "CREATOR"; status: "ALL" | MemberStatus; page: number };

export type MemberPage = { items: AdminMember[]; total: number; page: number; totalPages: number; filter: MemberFilter };

export type AdminCreatorRow = {
  creatorId: string;
  name: string;
  memberId: string;
  isLive: boolean;
  subscriberCount: number;
  joinedAt: string;
  status: MemberStatus;
};

export const MEMBERS_PAGE = 20;
/** 회원 · 크리에이터 검색어 길이 (the site's other searches use 40 too). */
export const ADMIN_QUERY_MAX = 40;
/** 이용 정지 기간: days, or `null` = 영구 정지 (no end — its remaining FN are settled by 남은 FN 정리). */
export const SUSPEND_DAYS = [1, 7, 30, null] as const;
export const SUSPEND_REASON = { min: 5, max: 200 } as const;

/**
 * 남은 FN 정리 (2026-10-08 결정) on a 영구 정지 member's detail: a 영구 정지 member cannot sign in, so on request an
 * operator refunds the remaining paid FN per charge under the 환불 정책 기본값 (수수료 공제 후 환불; 전액 취소 while a
 * charge is still within its 청약철회 period and unused — free FN counted as spent first, then oldest charge first) and
 * the free FN are forfeited; the balance goes to 0. Every amount is the site's, computed now.
 *
 * `status`: READY — can be processed; EMPTY — no FN left; BLOCKED — a refund request of the member waits or is on
 * 보류 (`blocked`: the message); NO_LEDGER — the mock has no wallet ledger for this member (only the sample member has
 * one; per-member ledgers come with the backend). `lines`: charges with refundable paid FN, oldest first; `total`: their
 * sums; `forfeitFn`: free FN (and FN no charge explains) written off. `history`: this account's earlier 정리, newest first.
 */
export type MemberFnSettlement = {
  status: "READY" | "EMPTY" | "BLOCKED" | "NO_LEDGER";
  blocked: string | null;
  balanceFn: number;
  lines: ChargeRefundLine[];
  total: { grossFn: number; feeFn: number; netFn: number; refundKrw: number };
  forfeitFn: number;
  history: { at: string; by: string; note: string; lines: ChargeRefundLine[]; forfeitFn: number }[];
};
/** 남은 FN 정리 처리 메모 (required). */
export const FN_SETTLE_NOTE = { min: 2, max: 200 } as const;

export type MemberActionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };

export const isSuspendedNow = (m: Pick<AdminMember, "status" | "suspension">, now = Date.now()) =>
  m.status === "SUSPENDED" && (!m.suspension?.until || new Date(m.suspension.until).getTime() > now);
