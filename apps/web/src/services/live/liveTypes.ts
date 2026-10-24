import type { Platform } from "@/types/platform";

/**
 * Live channel types, client-safe: the reads live in ./liveChannels.ts (server only — with the FLEXTV backend they call
 * FLEXTV).
 */

export type LiveChannel = {
  id: string;
  title: string;
  channelName: string;
  channelAvatarUrl: string;
  thumbnailUrl: string;
  viewerCount: number;
  platform: Platform;
  /** Seconds since the broadcast started, computed on the server when the list is fetched. */
  elapsedSeconds: number;
  href: string;
};

/** How many channels 인기 라이브 shows (the rest stay in 전체 라이브). Mock value; ranking rules are TBD. */
export const POPULAR_LIVE_COUNT = 8;
