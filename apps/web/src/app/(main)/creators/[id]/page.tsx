import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorRoomScreen } from "@/features/creatorRoom";
import { getMyAccount } from "@/services/account/myAccount";
import { getCreatorById } from "@/services/creators/creators";
import { getCreatorRoom } from "@/services/creators/creatorRoom";
import { parseChannelView } from "@/features/creatorRoom/channelView";
import { getCrewPublic } from "@/services/crew/crew";
import { isFavorite } from "@/services/favorites/favorites";

// Figma: live 826:685 · 610:138, offline 710:195
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string | string[]; view?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const creator = await getCreatorById((await params).id);
  return { title: creator ? `${creator.name} | Somnation` : "크리에이터 | Somnation" };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const { tab, view } = await searchParams;
  const [room, account, favorite, crew, creator] = await Promise.all([getCreatorRoom(id), getMyAccount(), isFavorite(id), getCrewPublic(id), getCreatorById(id)]);
  if (!room || !creator) notFound();

  return (
    <CreatorRoomScreen
      room={room}
      viewer={account ? { nickname: account.nickname, fnBalance: account.fnBalance } : null}
      isFavorite={favorite}
      initialTab={tab === "donation" ? "DONATION" : "CHAT"}
      view={tab === "donation" ? "home" : parseChannelView(view)}
      crew={crew}
      about={{ description: creator.description, categories: creator.categories, subscriberCount: creator.subscriberCount, joinedAt: creator.joinedAt }}
    />
  );
}
