import { isSuspendedNow, type Suspension } from "./memberTypes";

/**
 * Server-only member moderation state (not a "use server" module; no app imports, so the session and
 * creator services can read it without cycles). The directory itself is composed in admin/members.ts.
 */

export const SAMPLE_MEMBER_ID = "u-hongGD123";
export const creatorMemberId = (creatorId: string) => `m-${creatorId}`;
/** Member id of the slot's `n`-th withdrawn account (1 = the first) once a 재가입 started a new account in the slot. */
export const withdrawnMemberId = (n: number) => `${SAMPLE_MEMBER_ID}-w${n}`;

type GeneratedMember = { id: string; nickname: string; funationId: string; joinedAt: string; lastActiveAt: string; donationTotalFn: number; fnBalance: number };
type Store = { suspensions: Record<string, Suspension>; requests: Record<string, true>; supporters: GeneratedMember[] };

const NICKS = ["별빛시청자", "새벽라디오", "콩트러버", "여행가고파", "먹방요정", "댄스머신", "고양이집사", "퇴근후한잔", "삼국지덕후", "야식전문가", "리뷰장인", "산책러", "코딩하는곰", "라떼는말이야", "주말농부", "음악다락방", "게임은밤에", "책벌레", "사진찍는날", "바다보러가자"];

const g = globalThis as typeof globalThis & { __funationMockMembersV1?: Store };
export const memberStore = (): Store =>
  (g.__funationMockMembersV1 ??= {
    suspensions: {},
    requests: {},
    supporters: NICKS.map((nickname, i) => {
      const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000).toISOString().slice(0, 10);
      return {
        id: `u-s${String(i + 1).padStart(3, "0")}`,
        nickname,
        funationId: `member${String(i + 1).padStart(3, "0")}`,
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
