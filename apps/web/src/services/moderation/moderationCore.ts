import { creatorMemberId } from "@/services/admin/memberCore";
import { mockCommunity } from "@/services/community/mockCommunityStore";
import { channelCommunityStore } from "@/services/creators/channelCommunityCore";
import { mockMessages } from "@/services/messages/mockMessageStore";
import type { BlockEntry, Report, ReportTarget } from "./moderationTypes";

/**
 * Server-only moderation state (not a "use server" module): reports and per-member block lists, plus
 * how each target type maps to its author and how an operator hides it. Creator lookups are passed in
 * by callers (the creator service imports moderation-free modules only, avoiding cycles).
 */

/** A block as stored: the blocked member's id stays on the server; the browser sees the entry's own opaque id. */
export type StoredBlock = BlockEntry & { authorId: string };
/** `blocks`: blocker member id → blocked member id → entry. */
type Store = { reports: Report[]; requests: Record<string, string>; blocks: Record<string, Record<string, StoredBlock>> };
// V2: block entries get their own id (V1 used the blocked member's id).
const g = globalThis as typeof globalThis & { __funationMockModerationV2?: Store };
export const moderationStore = (): Store => (g.__funationMockModerationV2 ??= { reports: [], requests: {}, blocks: {} });

export type ResolvedTarget = { authorId: string; authorName: string; snapshot: string };
export type CreatorLookup = (id: string) => Promise<{ id: string; name: string; description: string } | null>;

const clip = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** The live content behind a report target, or null when it does not exist (or was removed). */
export async function resolveTarget(t: ReportTarget, findCreator: CreatorLookup): Promise<ResolvedTarget | null> {
  switch (t.type) {
    case "POST": {
      const p = mockCommunity.posts.find((x) => x.id === t.id && !x.deleted);
      return p ? { authorId: p.authorId, authorName: p.authorName, snapshot: clip(`${p.title}\n${p.body}`) } : null;
    }
    case "COMMENT": {
      const p = mockCommunity.posts.find((x) => x.id === t.parentId && !x.deleted);
      const c = p?.comments.find((x) => x.id === t.id && !x.deleted);
      return c ? { authorId: c.authorId, authorName: c.authorName, snapshot: clip(c.body) } : null;
    }
    case "CHANNEL_POST": {
      const p = channelCommunityStore().posts.find((x) => x.id === t.id && !x.deleted);
      return p ? { authorId: p.authorId, authorName: p.authorName, snapshot: clip(p.body) } : null;
    }
    case "MESSAGE": {
      // Only received mail can be reported (the reporter is its recipient). Mail comes from a creator's channel: the
      // author is that creator's member id, like everywhere else (admin member links, blocks on every content type).
      const m = mockMessages.messages.find((x) => x.id === t.id && x.direction === "IN" && !x.deleted);
      return m ? { authorId: creatorMemberId(m.peerId), authorName: m.peerName, snapshot: clip(m.body) } : null;
    }
    case "CREATOR": {
      const c = await findCreator(t.id);
      return c ? { authorId: creatorMemberId(c.id), authorName: c.name, snapshot: clip(`${c.name} — ${c.description}`) } : null;
    }
  }
}

/** Operator action "숨김": removes the content from the site (kept for evidence in the report snapshot). */
export function hideTarget(t: ReportTarget): boolean {
  switch (t.type) {
    case "POST": {
      const p = mockCommunity.posts.find((x) => x.id === t.id);
      if (p) p.deleted = true;
      return !!p;
    }
    case "COMMENT": {
      const c = mockCommunity.posts.find((x) => x.id === t.parentId)?.comments.find((x) => x.id === t.id);
      if (c) c.deleted = true;
      return !!c;
    }
    case "CHANNEL_POST": {
      const p = channelCommunityStore().posts.find((x) => x.id === t.id);
      if (p) p.deleted = true;
      return !!p;
    }
    case "MESSAGE": {
      const m = mockMessages.messages.find((x) => x.id === t.id);
      if (m) m.deleted = true;
      return !!m;
    }
    case "CREATOR":
      // A channel is not hidden per report; operators suspend the creator in 회원 관리 instead.
      return false;
  }
}

export const blocksOf = (memberId: string) => moderationStore().blocks[memberId] ?? {};
export const isBlockedBy = (memberId: string | null | undefined, authorId: string) => !!memberId && !!blocksOf(memberId)[authorId];
