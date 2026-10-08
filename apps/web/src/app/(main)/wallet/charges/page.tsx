import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChargeHistoryScreen, parseHistoryParams, type RawParams } from "@/features/wallet";
import { getChargeHistory, getWalletSummary } from "@/services/wallet/walletHistory";

// Figma: 640:2 · 639:2 · 643:4
export const metadata: Metadata = { title: "FN 충전내역 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { period, page } = parseHistoryParams(await searchParams);
  const [summary, data] = await Promise.all([getWalletSummary(), getChargeHistory({ period, page })]);
  if (!summary || !data) redirect("/login?next=/wallet/charges");
  return <ChargeHistoryScreen summary={summary} data={data} />;
}
