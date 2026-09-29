/**
 * Crew (크루) — code-first, no Figma frame (docs/figma/code-first-screens.md). A channel can have
 * crew members; supporters may attribute a donation to a member, and the channel sees a per-member
 * ranking. Reference idea: docs/research/funnation-reference.md P1-1 (크루/엑셀 방송).
 *
 * Money is unchanged: a member-attributed donation is the same Donation Core debit, credited to the
 * channel. How (or whether) earnings are split between members is TBD and not implemented.
 */

export const MAX_CREW_MEMBERS = 30;
export const MEMBER_NAME_RULE = /^[가-힣A-Za-z0-9 _]{1,12}$/;

export const CREW_ROLES = [
  { key: "LEADER", label: "대표" },
  { key: "MEMBER", label: "멤버" }
] as const;
export type CrewRole = (typeof CREW_ROLES)[number]["key"];

export type CrewMember = { id: string; name: string; role: CrewRole; active: boolean; color: string };

export type MemberRankRow = { memberId: string; name: string; role: CrewRole; totalFn: number; count: number; sharePercent: number };

export type CrewStudioView = { channelName: string; members: CrewMember[]; ranking: MemberRankRow[]; month: string };

/** Public crew info for a channel's donation panel (active members only). */
export type CrewPublic = { members: { id: string; name: string; role: CrewRole; color: string }[] };

export type CrewSaveResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

export const crewRoleLabel = (r: CrewRole) => CREW_ROLES.find((x) => x.key === r)!.label;
