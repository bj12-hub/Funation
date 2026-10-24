import { fetchActiveStream, fetchChannel, fetchSignatures } from "@/lib/flextv/donation";
import { getFlextvAccessToken } from "@/lib/session";
import { flextvCatalog } from "@/services/donations/flextvDonate";
import type { CreatorRoom } from "./creatorRoom";

/**
 * A FLEXTV channel's room (phase 3, docs/development/flextv-backend.md "3단계"): `/creators/{FLEXTV channel id}` shows
 * the channel's owner, whether it is on air, and FLEXTV's donation options. The player and chat come with phase 4.
 * Server-only read; null when FLEXTV has no such channel.
 */

const DEFAULT_AVATAR = "/mock/creators/creator-1.png";
const OFFLINE_IMAGE = "/mock/room/offline.jpg";
const FLEXTV_LOGO = "/mock/room/logo-flextv.png";

export async function getFlextvCreatorRoom(channelId: string): Promise<CreatorRoom | null> {
  const channel = await fetchChannel(channelId);
  if (!channel) return null;
  const token = await getFlextvAccessToken();
  const [stream, signatures] = await Promise.all([
    channel.live ? fetchActiveStream(channelId).catch(() => null) : Promise.resolve(null),
    fetchSignatures(channelId, token).catch(() => [])
  ]);
  const image = channel.backgroundUrl ?? OFFLINE_IMAGE;
  return {
    source: "FLEXTV",
    creatorId: channel.channelId,
    name: channel.owner.nickname,
    tagline: channel.description,
    avatarUrl: channel.owner.thumbUrl ?? DEFAULT_AVATAR,
    channels: [{ platform: "FLEXTV", logoUrl: FLEXTV_LOGO }],
    banner: null,
    stream: stream
      ? { status: "LIVE", caption: stream.title, viewerCount: null, thumbnailUrl: image, rankBadge: null, qualityLabel: "", goal: null }
      : { status: "OFFLINE", imageUrl: image },
    donation: flextvCatalog(signatures)
  };
}
