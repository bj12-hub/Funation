import { mockAccount } from "@/services/account/mockStore";
import { isWithdrawn, withdrawalStore, type PastAccount } from "@/services/account/withdrawalCore";
import { isSuspendedNow, type Suspension } from "./memberTypes";
import { WITHDRAWN_MEMBER_NAME } from "./paymentTypes";

/**
 * Server-only member moderation state (not a "use server" module; it imports leaf modules only, so the session and
 * creator services can read it without cycles). The directory itself is composed in admin/members.ts.
 */

export const SAMPLE_MEMBER_ID = "u-hongGD123";
export const creatorMemberId = (creatorId: string) => `m-${creatorId}`;
/** Member id of the slot's `n`-th withdrawn account (1 = the first) once a 재가입 started a new account in the slot. */
export const withdrawnMemberId = (n: number) => `${SAMPLE_MEMBER_ID}-w${n}`;

const WITHDRAWN_ID = new RegExp(`^${SAMPLE_MEMBER_ID}-w\\d+$`);
/** A withdrawn account: an earlier account of the slot (`…-wN`), or the slot's own while it is withdrawn. */
export const isWithdrawnMember = (memberId: string) => WITHDRAWN_ID.test(memberId) || (memberId === SAMPLE_MEMBER_ID && isWithdrawn());

/**
 * The member id that held the slot at `iso` (an ISO time): the N-th withdrawn account (`…-wN`) up to its withdrawal,
 * the slot's current account after the last one. Audit entries filed under the slot id are attributed with it, because
 * a 재가입 hands that id to a new account (the entries themselves are never rewritten).
 */
export const slotMemberAt = (iso: string) => {
  const n = withdrawalStore().past.findIndex((w) => iso <= w.at);
  return n < 0 ? SAMPLE_MEMBER_ID : withdrawnMemberId(n + 1);
};

/**
 * The slot account with this start marker (`accountSince`, as wallet records and refund requests are attributed): its
 * member id, and its withdrawal record when a 재가입 moved it aside (`…-wN`); otherwise the account holding the slot now.
 */
export const slotAccountOf = (account: string | null): { memberId: string; past: PastAccount | null } => {
  const past = withdrawalStore().past;
  const n = past.findIndex((p) => p.accountSince === account);
  return n < 0 ? { memberId: SAMPLE_MEMBER_ID, past: null } : { memberId: withdrawnMemberId(n + 1), past: past[n] };
};

/**
 * How the admin console names the slot account with this start marker (2026-10-08 결정): a withdrawn account keeps its
 * original nickname and is marked withdrawn — before a 재가입 (the slot's own, while withdrawn) and after it (`…-wN`).
 * The site's community screens say "탈퇴한 회원" instead (`shownMemberName`).
 */
export const slotAccountLabel = (account: string | null): { memberId: string; name: string; withdrawn: boolean } => {
  const a = slotAccountOf(account);
  if (a.past) return { memberId: a.memberId, name: a.past.nickname, withdrawn: true };
  const w = withdrawalStore().withdrawal;
  return { memberId: a.memberId, name: w ? w.nickname : mockAccount.nickname, withdrawn: !!w };
};

/**
 * The author name shown on 커뮤니티 posts and comments, channel posts and block lists: "탈퇴한 회원" for a withdrawn
 * member (2026-10-08 결정 — the content stays up), the stored nickname otherwise.
 */
export const shownMemberName = (memberId: string, name: string) => (isWithdrawnMember(memberId) ? WITHDRAWN_MEMBER_NAME : name);

type GeneratedMember = { id: string; nickname: string; ssumnationId: string; joinedAt: string; lastActiveAt: string; donationTotalFn: number; fnBalance: number };
type Store = { suspensions: Record<string, Suspension>; requests: Record<string, true>; supporters: GeneratedMember[] };

const NICKS = ["별빛시청자", "새벽라디오", "콩트러버", "여행가고파", "먹방요정", "댄스머신", "고양이집사", "퇴근후한잔", "삼국지덕후", "야식전문가", "리뷰장인", "산책러", "코딩하는곰", "라떼는말이야", "주말농부", "음악다락방", "게임은밤에", "책벌레", "사진찍는날", "바다보러가자"];

const g = globalThis as typeof globalThis & { __ssumnationMockMembersV1?: Store };
export const memberStore = (): Store =>
  (g.__ssumnationMockMembersV1 ??= {
    suspensions: {},
    requests: {},
    supporters: NICKS.map((nickname, i) => {
      const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);
      return {
        id: `u-s${String(i + 1).padStart(3, "0")}`,
        nickname,
        ssumnationId: `member${String(i + 1).padStart(3, "0")}`,
        joinedAt: day(i * 11),
        lastActiveAt: day(250 + (i % 20)),
        donationTotalFn: ((i * 37) % 20) * 5_000,
        fnBalance: ((i * 13) % 10) * 3_000
      };
    })
  });

export const suspensionOf = (memberId: string) => memberStore().suspensions[memberId] ?? null;

/** True while an active suspension covers this member (an expired one no longer counts). */
export const isMemberSuspended = (memberId: string, now = Date.now()) => {
  const s = suspensionOf(memberId);
  return !!s && isSuspendedNow({ status: "SUSPENDED", suspension: s }, now);
};

export const isCreatorSuspended = (creatorId: string) => isMemberSuspended(creatorMemberId(creatorId));
