import { PageLoading } from "@/components/layout/PageLoading";
import { getT } from "@/lib/i18n/server";

// Figma 817:7773 Common / Loading
export default async function Loading() {
  return <PageLoading label={(await getT())("platformDonation.loading")} />;
}
