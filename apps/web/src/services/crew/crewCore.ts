import type { MemberRankRow } from "./crewTypes";
import { mockCrew } from "./mockCrewStore";

/**
 * Server-only crew internals shared with the Donation Core. Not a "use server" module: attributing
 * a donation to a member must only happen inside a completed donation.
 */

/** Whether `memberId` is an active member of `channelId`'s crew. */
export const isActiveMember = (channelId: string, memberId: unknown) =>
  typeof memberId === "string" && (mockCrew.crews[channelId] ?? []).some((x) => x.id === memberId && x.active);

export function attributeMemberDonation(donationId: string, channelId: string, memberId: string | null, fnAmount: number) {
  if (!memberId || !isActiveMember(channelId, memberId)) return;
  mockCrew.attributions.push({ donationId, channelId, memberId, fnAmount, at: new Date().toISOString() });
}

/** This month's per-member totals for a channel (members without donations included, sorted by FN). */
export function memberRanking(channelId: string): MemberRankRow[] {
  const members = mockCrew.crews[channelId] ?? [];
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rows = members.map((mem) => {
    const mine = mockCrew.attributions.filter((a) => a.channelId === channelId && a.memberId === mem.id && a.at.startsWith(month));
    return { memberId: mem.id, name: mem.name, role: mem.role, totalFn: mine.reduce((s, a) => s + a.fnAmount, 0), count: mine.length, sharePercent: 0 };
  });
  const total = rows.reduce((s, r) => s + r.totalFn, 0);
  for (const r of rows) r.sharePercent = total ? Math.round((r.totalFn / total) * 1000) / 10 : 0;
  return rows.sort((a, b) => b.totalFn - a.totalFn || a.name.localeCompare(b.name));
}
