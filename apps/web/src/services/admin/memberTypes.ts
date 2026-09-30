import type { Role } from "@/types/role";

/**
 * 회원 · 크리에이터 관리 — code-first. Client-safe types. Suspension rules (grounds, appeal, what a
 * suspended member keeps — FN balance, pending settlements) are TBD; durations here are operator choices.
 */

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
export const SUSPEND_DAYS = [1, 7, 30, null] as const;
export const SUSPEND_REASON = { min: 5, max: 200 } as const;

export type MemberActionResult = { status: "OK" } | { status: "INVALID"; message: string } | { status: "NOT_FOUND" | "UNAUTHORIZED" };

export const isSuspendedNow = (m: Pick<AdminMember, "status" | "suspension">, now = Date.now()) =>
  m.status === "SUSPENDED" && (!m.suspension?.until || new Date(m.suspension.until).getTime() > now);
