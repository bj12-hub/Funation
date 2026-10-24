import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreatorRoomScreen } from "@/features/creatorRoom";
import { fetchChannel, isFlextvChannelId } from "@/lib/flextv/donation";
import { FLEXTV_DONATION } from "@/lib/flextv/mode";
import { getSession } from "@/lib/session";
import { getMyAccount } from "@/services/account/myAccount";
import { getMovedChannelHandle } from "@/services/channel/channel";
import { getCreatorById } from "@/services/creators/creators";
import { getCreatorRoom } from "@/services/creators/creatorRoom";
import { getChannelMonthlyRanking, getChannelPosts } from "@/services/creators/channelHome";
import { CHANNEL_POSTS_PAGE } from "@/services/creators/channelTypes";
import { getPublicChannelVideos } from "@/services/creators/channelVideos";
import { getFlextvCreatorRoom } from "@/services/creators/flextvChannel";
import { getWalletBalance } from "@/services/wallet/balance";
import { parseChannelView, type ChannelView } from "@/features/creatorRoom/channelView";
import { getCrewPublic } from "@/services/crew/crew";
import { getRoomFanNotes } from "@/services/crew/crewFanNotes";
import { isFavorite } from "@/services/favorites/favorites";
import { getRoomVote } from "@/services/votes/votes";

// Figma: live 826:685 · 610:138, offline 710:195
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string | string[]; view?: string | string[]; show?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  if (FLEXTV_DONATION && isFlextvChannelId(id)) {
    const channel = await fetchChannel(id).catch(() => null);
    return { title: channel ? `${channel.owner.nickname} | Ssumnation` : "크리에이터 | Ssumnation" };
  }
  const creator = await getCreatorById(id);
  return { title: creator ? `${creator.name} | Ssumnation` : "크리에이터 | Ssumnation" };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const { tab, view, show } = await searchParams;
  if (FLEXTV_DONATION && isFlextvChannelId(id)) return <FlextvRoom channelId={id} view={tab === "donation" ? "home" : parseChannelView(view)} />;
  const postsShow = Math.min(Math.max(CHANNEL_POSTS_PAGE, Math.floor(Number(show)) || CHANNEL_POSTS_PAGE), 100);
  const channelView = tab === "donation" ? "home" : parseChannelView(view);
  const [room, account, favorite, crew, creator, ranking, posts, videos, vote, fanNotes] = await Promise.all([
    getCreatorRoom(id),
    getMyAccount(),
    isFavorite(id),
    getCrewPublic(id),
    getCreatorById(id),
    getChannelMonthlyRanking(id),
    getChannelPosts(id, postsShow),
    channelView === "videos" ? getPublicChannelVideos(id) : null,
    getRoomVote(id),
    getRoomFanNotes(id)
  ]);
  if (!room || !creator || !ranking || !posts) {
    // 예전 채널 주소는 새 주소로 연결 (2026-10-08 결정): an old address points to the new one for 30 days.
    const moved = await getMovedChannelHandle(id);
    if (moved) redirect(`/creators/${encodeURIComponent(moved)}`);
    notFound();
  }

  return (
    <CreatorRoomScreen
      room={room}
      viewer={account ? { nickname: account.nickname, fnBalance: account.fnBalance } : null}
      isFavorite={favorite}
      initialTab={tab === "donation" ? "DONATION" : "CHAT"}
      view={channelView}
      crew={crew}
      about={{ description: creator.description, categories: creator.categories, subscriberCount: creator.subscriberCount, joinedAt: creator.joinedAt }}
      ranking={ranking}
      posts={posts}
      postsShow={postsShow}
      videos={videos}
      vote={vote}
      fanNotes={fanNotes}
    />
  );
}

/**
 * A FLEXTV channel's room (FLEXTV backend phase 3, docs/development/flextv-backend.md): the channel, FLEXTV's donation
 * options and the member's 렉스. Ssumnation's own parts of a room are empty here and not shown.
 */
async function FlextvRoom({ channelId, view }: { channelId: string; view: ChannelView }) {
  const [room, session, balance] = await Promise.all([getFlextvCreatorRoom(channelId), getSession(), getWalletBalance()]);
  if (!room) notFound();
  return (
    <CreatorRoomScreen
      room={room}
      viewer={session ? { nickname: session.nickname, fnBalance: balance } : null}
      isFavorite={false}
      initialTab="DONATION"
      view={view === "signatures" ? "signatures" : "home"}
      crew={{ members: [] }}
      about={{ description: room.tagline, categories: [], subscriberCount: 0, joinedAt: "" }}
      ranking={{ month: "", rows: [] }}
      posts={{ items: [], total: 0, hasMore: false }}
      postsShow={CHANNEL_POSTS_PAGE}
      videos={null}
      vote={null}
      fanNotes={null}
    />
  );
}
