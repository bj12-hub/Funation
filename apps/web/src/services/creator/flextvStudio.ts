import { cache } from "react";
import { fetchMyChannelData, readMyChannel, type MyChannel } from "@/lib/flextv/studio";
import { requestOrigin } from "@/lib/flextv/request";
import { getCreatorSession, getFlextvAccessToken, type Session } from "@/lib/session";
import type { CreatorProfile } from "./creatorStudio";

/**
 * The studio's FLEXTV reads shared by its pages (phase 5, docs/development/flextv-backend.md "5단계"). One render of the
 * studio layout and its page asks FLEXTV for the member's channel once.
 */

/** Per request: the layout and the page read the same answer. */
const channelData = cache((token: string) => fetchMyChannelData(token));

export type StudioContext = { session: Session; token: string };

export async function studioContext(): Promise<StudioContext | null> {
  const session = await getCreatorSession();
  const token = session && (await getFlextvAccessToken());
  return session && token ? { session, token } : null;
}

export async function myChannel(token: string): Promise<{ channel: MyChannel; data: unknown } | null> {
  const data = await channelData(token);
  const channel = data === null ? null : readMyChannel(data);
  return channel ? { channel, data } : null;
}

/** The studio header and the dashboard's 내 채널 card: the member's FLEXTV channel, whose room is `/creators/{id}`. */
export async function flextvCreatorProfile(): Promise<CreatorProfile | null> {
  const ctx = await studioContext();
  if (!ctx) return null;
  const mine = await myChannel(ctx.token);
  if (!mine) return null;
  return {
    channelName: mine.channel.name || ctx.session.nickname,
    handle: ctx.session.ssumnationId,
    avatarUrl: ctx.session.avatarUrl,
    donateUrl: `${await requestOrigin()}/creators/${mine.channel.channelId}`,
    platforms: [{ platform: "FLEXTV", logoUrl: "/mock/room/logo-flextv.png", connected: true }]
  };
}
