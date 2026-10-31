import { PageLoading } from "@/components/layout/PageLoading";
import { getT } from "@/lib/i18n/server";

export default async function Loading() {
  return <PageLoading label={(await getT())("studioRanking.loading")} />;
}
