import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CreatorRoomScreen } from "@/features/creatorRoom";
import { getMyAccount } from "@/services/account/myAccount";
import { getMovedChannelHandle } from "@/services/channel/channel";
import { getCreatorById } from "@/services/creators/creators";
import { getCreatorRoom } from "@/services/creators/creatorRoom";
import { getChannelMonthlyRanking, getChannelPosts } from "@/services/creators/channelHome";
import { CHANNEL_POSTS_PAGE } from "@/services/creators/channelTypes";
import { getPublicChannelVideos } from "@/services/creators/channelVideos";
import { parseChannelView } from "@/features/creatorRoom/channelView";
import { getCrewPublic } from "@/services/crew/crew";
import { getRoomFanNotes } from "@/services/crew/crewFanNotes";
import { isFavorite } from "@/services/favorites/favorites";
import { getRoomVote } from "@/services/votes/votes";

// Figma: live 826:685 · 610:138, offline 710:195
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string | string[]; view?: string | string[]; show?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const creator = await getCreatorById((await params).id);
  return { title: creator ? `${creator.name} | Somnation` : "크리에이터 | Somnation" };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const { tab, view, show } = await searchParams;
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
