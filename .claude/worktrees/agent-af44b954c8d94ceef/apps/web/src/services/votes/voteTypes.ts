/**
 * 투표 (code-first; 2026-10-04 결정: 무료 투표만). The creator starts a 투표 위젯 preset from the 리모컨,
 * signed-in viewers vote once each in the creator room, and the 투표 overlay shows the counts.
 * No FN moves, so a vote is not part of the Donation Core. Client-safe types only.
 */

/** What the room, the 리모컨 and the overlay show for one vote. */
export type VoteBoard = {
  id: string;
  name: string;
  color: string;
  /** In preset order. */
  items: { label: string; count: number }[];
  total: number;
  startedAt: string;
  endsAt: string;
  /** Ended early from the 리모컨, or past `endsAt`. */
  ended: boolean;
};

/** The room's vote card: `myChoice` is the viewer's item index (null = not voted or signed out). */
export type RoomVote = VoteBoard & { myChoice: number | null };

export type CastVoteResult =
  | { status: "VOTED"; vote: RoomVote }
  | { status: "ALREADY_VOTED"; vote: RoomVote }
  | { status: "ENDED"; vote: RoomVote }
  | { status: "NOT_FOUND" }
  | { status: "INVALID"; message: string }
  | { status: "UNAUTHORIZED" };

export type VoteControlResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** A 투표 위젯 preset as the 리모컨 offers it; `ready` = at least two filled items. */
export type VoteRemotePreset = { id: string; label: string; color: string; durationSec: number; items: string[]; ready: boolean };

export type VoteRemoteView = {
  /** 투표 위젯 사용하기 — off hides the overlay only; the room still takes votes. */
  widgetEnabled: boolean;
  presets: VoteRemotePreset[];
  board: VoteBoard | null;
};

/** Competition ranking for the overlay: tied counts share a rank. */
export function rankItems(board: Pick<VoteBoard, "items">) {
  return board.items
    .map((it, index) => ({ ...it, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((it, _, all) => ({ ...it, rank: 1 + all.filter((o) => o.count > it.count).length }));
}

export const votePercent = (count: number, total: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);
