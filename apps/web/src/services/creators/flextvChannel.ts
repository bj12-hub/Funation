import { fetchChannel, fetchSignatures } from "@/lib/flextv/donation";
import { embedPlayerUrl, fetchWatch, flextvLiveUrl, type Watch } from "@/lib/flextv/live";
import { getFlextvAccessToken } from "@/lib/session";
import { flextvCatalog } from "@/services/donations/flextvDonate";
import type { CreatorRoom } from "./creatorRoom";

/**
 * A FLEXTV channel's room (phases 3 · 4, docs/development/flextv-backend.md): `/creators/{FLEXTV channel id}` shows the
 * channel's owner, its stream in FLEXTV's player (or a way to FLEXTV for a stream only some viewers may watch), the
 * stream's chat and FLEXTV's donation options. Server-only read; null when FLEXTV has no such channel.
 */

const DEFAULT_AVATAR = "/mock/creators/creator-1.png";
const OFFLINE_IMAGE = "/mock/room/offline.jpg";
const FLEXTV_LOGO = "/mock/room/logo-flextv.png";

export async function getFlextvCreatorRoom(channelId: string): Promise<CreatorRoom | null> {
  const channel = await fetchChannel(channelId);
  if (!channel) return null;
  const token = await getFlextvAccessToken();
  const [watch, signatures] = await Promise.all([
    channel.live ? fetchWatch(channelId).catch((): Watch => ({ kind: "OFFLINE" })) : Promise.resolve<Watch>({ kind: "OFFLINE" }),
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
    stream: streamOf(channelId, watch, image),
    donation: flextvCatalog(signatures)
  };
}

function streamOf(channelId: string, watch: Watch, image: string): CreatorRoom["stream"] {
  switch (watch.kind) {
    case "EMBED":
      return {
        status: "LIVE",
        caption: watch.title,
        viewerCount: watch.viewers,
        thumbnailUrl: image,
        rankBadge: null,
        qualityLabel: "",
        goal: null,
        embed: { playerUrl: embedPlayerUrl(channelId), streamId: watch.streamId }
      };
    case "ON_FLEXTV":
      return {
        status: "LIVE",
        caption: "",
        viewerCount: null,
        thumbnailUrl: image,
        rankBadge: null,
        qualityLabel: "",
        goal: null,
        onFlextv: { url: flextvLiveUrl(channelId), reason: watch.reason }
      };
    default:
      return { status: "OFFLINE", imageUrl: image };
  }
}
