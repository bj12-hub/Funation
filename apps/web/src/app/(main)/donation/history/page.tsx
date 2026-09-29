import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationHistoryScreen } from "@/features/platformDonation/DonationHistoryScreen";
import { getDonationHistory } from "@/services/platformDonation/donationHistory";

// Figma: 후원 내역 817:8038 · 817:8223
export const metadata: Metadata = { title: "후원 내역 | Somnation" };
export const dynamic = "force-dynamic";

type Search = { tab?: string; period?: string; status?: string; q?: string; tx?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const view = await getDonationHistory(await searchParams);
  if (!view) redirect("/login?next=/donation/history");
  return <DonationHistoryScreen view={view} />;
}
