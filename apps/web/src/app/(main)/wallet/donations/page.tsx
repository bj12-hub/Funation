import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationHistoryScreen, parseDonationFilter, parseHistoryParams, type RawParams } from "@/features/wallet";
import { getDonationHistory } from "@/services/wallet/walletHistory";

// Figma: 632:4 · 637:214
export const metadata: Metadata = { title: "FN 후원내역 | Ssumnation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  const raw = await searchParams;
  const { period, page, category } = parseHistoryParams(raw);
  const filter = parseDonationFilter(raw);
  const data = await getDonationHistory({ period, category, page, filter });
  if (!data) redirect("/login?next=/wallet/donations");
  return <DonationHistoryScreen data={data} category={category} filter={filter} />;
}
