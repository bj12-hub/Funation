import { PageLoading } from "@/components/layout/PageLoading";
import { getT } from "@/lib/i18n/server";

export default async function Loading() {
  const t = await getT();
  return <PageLoading label={t("studioSettlement.loadingApply")} />;
}
