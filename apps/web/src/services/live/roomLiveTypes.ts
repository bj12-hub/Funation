/** A live room's running figures (phase 10, docs/development/flextv-backend.md "10단계"). */

/** One of the stream's top donors, as FLEXTV ranks them: rank 1–3, nickname, 렉스 (FN) this stream. */
export type RoomDonor = { rank: number; nickname: string; amount: number; avatarUrl: string | null };

/** Null: FLEXTV did not say this time (the room keeps what it shows). */
export type RoomLive = { viewers: number | null; donors: RoomDonor[] | null };

/** How often an open room asks again (FLEXTV's own room hears these over its socket). */
export const ROOM_LIVE_POLL_MS = 15_000;
