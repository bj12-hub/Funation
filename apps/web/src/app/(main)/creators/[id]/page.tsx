import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreatorRoomScreen } from "@/features/creatorRoom";
import { getMyAccount } from "@/services/account/myAccount";
import { getCreatorById } from "@/services/creators/creators";
import { getCreatorRoom } from "@/services/creators/creatorRoom";
import { isFavorite } from "@/services/favorites/favorites";

// Figma: live 826:685 · 610:138, offline 710:195
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string | string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const creator = await getCreatorById((await params).id);
  return { title: creator ? `${creator.name} | Somnation` : "크리에이터 | Somnation" };
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const [room, account, favorite] = await Promise.all([getCreatorRoom(id), getMyAccount(), isFavorite(id)]);
  if (!room) notFound();

  return (
    <CreatorRoomScreen
      room={room}
      viewer={account ? { nickname: account.nickname, fnBalance: account.fnBalance } : null}
      isFavorite={favorite}
      initialTab={tab === "donation" ? "DONATION" : "CHAT"}
    />
  );
}
