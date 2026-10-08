import { VOTE_ITEMS_MIN, type VotePreset } from "@/services/creator/widgetSettingsTypes";
import type { RoomVote, VoteBoard } from "./voteTypes";

/**
 * Server-only vote store (not a "use server" module): the 리모컨 actions start and end votes, the room
 * actions record ballots, and the 투표 overlay reads them. Free (2026-10-04 결정), one ballot per person per vote
 * (2026-10-08 결정: keyed by the phone verified at sign-up, like 출석 — a 재가입 with the same phone has already
 * voted). The backend must enforce the one-ballot rule with a unique (vote, person) key.
 */
export type VoteRun = {
  id: string;
  channelId: string;
  presetId: string;
  name: string;
  color: string;
  items: string[];
  startedAt: string;
  endsAt: string;
  /** Ended early from the 리모컨. */
  endedAt: string | null;
  /** Taken off the screen (결과 내리기, or a new vote started). */
  closedAt: string | null;
  /** person (`currentPersonKey`, server-only) → item index. Only counts leave the server. */
  ballots: Record<string, number>;
  /** The 리모컨 request that started it, so a retried start is a no-op. */
  startRequestId: string;
};

/**
 * Seed: a running vote in one live creator room (c1) so a viewer can try voting. Its ballots come from
 * sample members; the studio channel starts with none.
 */
function seedVotes(now = Date.now()): VoteRun[] {
  const counts = [14, 9, 6];
  const ballots: Record<string, number> = {};
  let n = 0;
  counts.forEach((c, item) => {
    for (let i = 0; i < c; i++) ballots[`seed-member-${++n}`] = item;
  });
  return [
    {
      id: "vote-seed-c1",
      channelId: "c1",
      presetId: "seed",
      name: "방송 끝나고 뭐 할까요?",
      color: "#3B82F6",
      items: ["노래 한 곡", "게임 한 판", "사연 읽기"],
      startedAt: new Date(now - 10 * 60_000).toISOString(),
      endsAt: new Date(now + 3 * 3600_000).toISOString(),
      endedAt: null,
      closedAt: null,
      ballots,
      startRequestId: "seed"
    }
  ];
}

// V2: ballots are keyed by person (V1 by member id).
const g = globalThis as typeof globalThis & { __ssumnationMockVotesV2?: { runs: VoteRun[] } };
export const mockVotes = (g.__ssumnationMockVotesV2 ??= { runs: seedVotes() });

export const isEnded = (r: VoteRun, now = Date.now()) => r.endedAt !== null || now >= Date.parse(r.endsAt);

/** The vote a channel shows: its latest one, until the creator takes it off the screen. */
export function currentRun(channelId: string): VoteRun | null {
  const last = mockVotes.runs.filter((r) => r.channelId === channelId).at(-1);
  return last && !last.closedAt ? last : null;
}

export function voteBoard(r: VoteRun, now = Date.now()): VoteBoard {
  const counts = r.items.map(() => 0);
  for (const i of Object.values(r.ballots)) counts[i] += 1;
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    items: r.items.map((label, i) => ({ label, count: counts[i] })),
    total: Object.keys(r.ballots).length,
    startedAt: r.startedAt,
    endsAt: r.endsAt,
    ended: isEnded(r, now)
  };
}

/** `person`: the viewer (`currentPersonKey`), or null for a guest. */
export const roomVote = (r: VoteRun, person: string | null, now = Date.now()): RoomVote => ({
  ...voteBoard(r, now),
  myChoice: person !== null && Object.hasOwn(r.ballots, person) ? r.ballots[person] : null
});

/** Filled items of a preset (blank rows are skipped); a preset needs two to start. */
export const presetItems = (p: VotePreset) => p.items.map((i) => i.trim()).filter(Boolean);
export const presetReady = (p: VotePreset) => presetItems(p).length >= VOTE_ITEMS_MIN;
export const presetLabel = (p: VotePreset, index: number) => p.name.trim() || `${index + 1}번 투표`;

/**
 * One ballot per person. The same choice again answers VOTED (a retried request), another choice is
 * refused, and nothing is recorded once the vote has ended.
 */
export function castBallot(r: VoteRun, person: string, item: unknown, now = Date.now()): "VOTED" | "ALREADY_VOTED" | "ENDED" | "INVALID" {
  if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item >= r.items.length) return "INVALID";
  if (Object.hasOwn(r.ballots, person)) return r.ballots[person] === item ? "VOTED" : "ALREADY_VOTED";
  if (isEnded(r, now)) return "ENDED";
  r.ballots[person] = item;
  return "VOTED";
}
