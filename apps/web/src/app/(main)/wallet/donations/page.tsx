import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationHistoryScreen, parseHistoryParams, type RawParams } from "@/features/wallet";
import { getDonationHistory } from "@/services/wallet/walletHistory";

// Figma: 632:4 · 637:214
export const metadata: Metadata = { title: "FN 후원내역 | Somnation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  const { period, page, category } = parseHistoryParams(await searchParams);
  const data = await getDonationHistory({ period, category, page });
  if (!data) redirect("/login?next=/wallet/donations");
  return <DonationHistoryScreen data={data} category={category} />;
}
