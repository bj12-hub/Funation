import type { FeedEntry, FeedSource, MemberRankRow } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

// ── 후원 리스트 (server-only) ──────────────────────────────────────────────────

export const liveBroadcastOf = (channelId: string) => (mockCrew.broadcasts ?? []).find((b) => b.channelId === channelId && !b.endedAt) ?? null;

/** The single active member whose keyword appears in the message; ambiguous or none → null. */
export function matchMember(channelId: string, message: string): string | null {
  const text = message.toLowerCase();
  const keywords = mockCrew.keywords ?? {};
  const hits = (mockCrew.crews[channelId] ?? []).filter((m) => m.active && (keywords[m.id] ?? []).some((k) => text.includes(k.toLowerCase())));
  return hits.length === 1 ? hits[0].id : null;
}

/** Adds a donation to the live broadcast's 후원 리스트, applying 한방 and the assign mode. */
export function addFeedEntry(b: MockBroadcast, input: { donor: string; message: string; fnAmount: number; source: FeedSource }, now = Date.now()): FeedEntry {
  const feed = (b.feed ??= []);
  const suggested = matchMember(b.channelId, input.message);
  const base = { id: `fd-${now.toString(36)}-${feed.length}`, at: new Date(now).toISOString(), ...input, suggestedMemberId: suggested, oneshot: false };
  let entry: FeedEntry;
  if (b.oneshot) entry = { ...base, status: "POT", memberId: null, oneshot: true };
  else if (suggested && (b.assignMode ?? "AUTO") === "AUTO") entry = { ...base, status: "ASSIGNED", memberId: suggested };
  else entry = { ...base, status: suggested ? "PENDING" : "UNMATCHED", memberId: null };
  feed.push(entry);
  return entry;
}

/**
 * Called by the Donation Core for a completed donation without a member target. Only a live crew
 * broadcast on that channel collects it (member-targeted donations are already scored directly).
 */
export function recordBroadcastDonation(channelId: string, input: { donor: string; message: string; fnAmount: number }) {
  const live = liveBroadcastOf(channelId);
  if (live) addFeedEntry(live, { ...input, source: "DONATION" });
}

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
