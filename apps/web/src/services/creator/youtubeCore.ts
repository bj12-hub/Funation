import type { ChannelProfile, PlatformErrorCode } from "@/services/platforms/platformTypes";
import type { ManagedVideo } from "./youtubeTypes";

/** Server-only YouTube integration state (not a "use server" module); shared with 후원 연동. */
export type YouTubeStore = {
  channel: ChannelProfile | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: PlatformErrorCode | null;
  videos: Record<string, ManagedVideo>;
  requests: Record<string, true>;
};

const g = globalThis as typeof globalThis & { __funationMockYouTubeV1?: YouTubeStore };
export const youtubeStore = (): YouTubeStore => (g.__funationMockYouTubeV1 ??= { channel: null, connectedAt: null, lastSyncedAt: null, lastError: null, videos: {}, requests: {} });
