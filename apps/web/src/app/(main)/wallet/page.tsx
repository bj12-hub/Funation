import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WalletOverviewScreen } from "@/features/wallet/WalletOverviewScreen";
import { getWalletOverview } from "@/services/wallet/walletHistory";

// Figma: FN Wallet 817:7552
export const metadata: Metadata = { title: "FN Wallet | Funation" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; period?: string; page?: string }> }) {
  const view = await getWalletOverview(await searchParams);
  if (!view) redirect("/login?next=/wallet");
  return <WalletOverviewScreen view={view} />;
}
