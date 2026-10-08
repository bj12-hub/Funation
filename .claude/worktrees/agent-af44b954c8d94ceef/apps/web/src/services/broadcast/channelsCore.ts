import { youtubeStore } from "@/services/creator/youtubeCore";
import type { Platform } from "@/types/platform";

/**
 * Server-only broadcast channel connections (not a "use server" module) — which platform channel the
 * creator streams on, for 통합 채팅 and 통합 후원 알림. YouTube reuses 유튜브 연동 (OAuth — TBD); the
 * others are connected by channel id/handle in the mock (each platform's login/OAuth — TBD).
 * TBD: per-creator storage (the mock has one creator), token refresh, disconnect on platform revoke.
 */

export type BroadcastChannel = { platform: Platform; externalChannelId: string; handle: string; title: string; connectedAt: string };

type ChannelsStore = { channels: Partial<Record<Platform, BroadcastChannel>> };

const g = globalThis as typeof globalThis & { __funationMockBroadcastChannelsV1?: ChannelsStore };
export const channelsStore = (): ChannelsStore => (g.__funationMockBroadcastChannelsV1 ??= { channels: {} });

export function broadcastChannel(p: Platform): BroadcastChannel | null {
  if (p === "YOUTUBE") {
    const yt = youtubeStore();
    return yt.channel ? { platform: "YOUTUBE", externalChannelId: yt.channel.externalChannelId, handle: yt.channel.handle, title: yt.channel.title, connectedAt: yt.connectedAt ?? "" } : null;
  }
  return channelsStore().channels[p] ?? null;
}

export const broadcastChannelId = (p: Platform) => broadcastChannel(p)?.externalChannelId ?? null;
