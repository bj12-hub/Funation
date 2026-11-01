import { fetchChannel } from "@/lib/flextv/donation";
import { embedPlayerUrl, fetchWatch, flextvLiveUrl, type Watch } from "@/lib/flextv/live";
import { FLEXTV_DEFAULT_AVATAR } from "@/lib/flextv/placeholders";
import { fetchThemes } from "@/lib/flextv/studio";
import { getFlextvAccessToken } from "@/lib/session";
import { loadFlextvCatalog } from "@/services/donations/flextvDonate";
import { getFlextvRoomLive } from "@/services/live/flextvRoomLive";
import type { RoomLive } from "@/services/live/roomLiveTypes";
import type { CreatorRoom } from "./creatorRoom";

/**
 * A FLEXTV channel's room (phases 3 · 4, docs/development/flextv-backend.md): `/creators/{FLEXTV channel id}` shows the
 * channel's owner, its stream in FLEXTV's player (or a way to FLEXTV for a stream only some viewers may watch), the
 * stream's chat and the channel's donation options (phase 6: 영상 후원 and Ssumnation's own types as the streamer set
 * them). Phase 10: a stream played here also has its category, start and running figures (viewers, top donors).
 * Server-only read; null when FLEXTV has no such channel.
 */

const OFFLINE_IMAGE = "/mock/room/offline.jpg";
const FLEXTV_LOGO = "/mock/room/logo-flextv.png";

export async function getFlextvCreatorRoom(channelId: string): Promise<CreatorRoom | null> {
  const channel = await fetchChannel(channelId);
  if (!channel) return null;
  const token = await getFlextvAccessToken();
  const [watch, donation] = await Promise.all([
    channel.live ? fetchWatch(channelId).catch((): Watch => ({ kind: "OFFLINE" })) : Promise.resolve<Watch>({ kind: "OFFLINE" }),
    loadFlextvCatalog(channelId, token)
  ]);
  const image = channel.backgroundUrl ?? OFFLINE_IMAGE;
  const [category, live] =
    watch.kind === "EMBED"
      ? await Promise.all([
          watch.themeId ? fetchThemes().then((themes) => themes.find((t) => t.value === watch.themeId)?.label ?? null, () => null) : Promise.resolve(null),
          getFlextvRoomLive(channelId)
        ])
      : [null, null];
  return {
    source: "FLEXTV",
    creatorId: channel.channelId,
    name: channel.owner.nickname,
    tagline: channel.description,
    avatarUrl: channel.owner.thumbUrl ?? FLEXTV_DEFAULT_AVATAR,
    channels: [{ platform: "FLEXTV", logoUrl: FLEXTV_LOGO }],
    banner: null,
    stream: streamOf(channelId, watch, image, { category, live }),
    donation,
    followers: channel.followers,
    ownerLoginId: channel.owner.loginId
  };
}

function streamOf(channelId: string, watch: Watch, image: string, extra: { category: string | null; live: RoomLive | null }): CreatorRoom["stream"] {
  switch (watch.kind) {
    case "EMBED":
      return {
        status: "LIVE",
        caption: watch.title,
        viewerCount: extra.live?.viewers ?? watch.viewers,
        startedAt: watch.startedAt,
        category: extra.category,
        live: { viewers: extra.live?.viewers ?? watch.viewers, donors: extra.live?.donors ?? [] },
        thumbnailUrl: image,
        rankBadge: null,
        qualityLabel: "",
        goal: null,
        embed: { playerUrl: embedPlayerUrl(channelId), streamId: watch.streamId, portrait: watch.portrait }
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
