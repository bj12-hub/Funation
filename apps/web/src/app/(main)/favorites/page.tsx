import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FavoritesScreen } from "@/features/favorites";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session";
import { getFavorites, getFavoritesPromotion } from "@/services/favorites/favorites";

// Figma: ssumnation-favorites-page 735:3856
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("myFavorites.meta") };
}
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string | string[]; page?: string | string[] }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { q, page } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 50) || undefined : undefined;
  const pageNumber = typeof page === "string" && Number.isInteger(Number(page)) ? Number(page) : 1;

  // Route guard for UX only; the backend must authorize the favorites API.
  const [session, data, promotion] = await Promise.all([getSession(), getFavorites({ query, page: pageNumber }), getFavoritesPromotion()]);
  if (!session || !data) redirect("/login?next=/favorites");

  return (
    <>
      <FavoritesScreen data={data} query={query} promotion={promotion} />
    </>
  );
}
