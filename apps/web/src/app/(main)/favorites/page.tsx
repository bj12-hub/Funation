import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SideNavLayout } from "@/components/layout/SideNav";
import { FavoritesScreen } from "@/features/favorites";
import { getMyAccount } from "@/services/account/myAccount";
import { getFavorites, getFavoritesPromotion } from "@/services/favorites/favorites";

// Figma: funation-favorites-page 735:3856
export const metadata: Metadata = { title: "즐겨찾기 | Funation" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string | string[]; page?: string | string[] }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { q, page } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 50) || undefined : undefined;
  const pageNumber = typeof page === "string" && Number.isInteger(Number(page)) ? Number(page) : 1;

  // Route guard for UX only; the backend must authorize the favorites API.
  const [account, data, promotion] = await Promise.all([getMyAccount(), getFavorites({ query, page: pageNumber }), getFavoritesPromotion()]);
  if (!account || !data) redirect("/login?next=/favorites");

  return (
    <SideNavLayout
      user={{ nickname: account.nickname, funationId: account.funationId, avatarUrl: account.avatarUrl, fnBalance: account.fnBalance }}
      showWatchHistory
    >
      <FavoritesScreen data={data} query={query} promotion={promotion} />
    </SideNavLayout>
  );
}
