import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationsAdminScreen } from "@/features/admin/payments/PaymentScreens";
import { getDonationsView } from "@/services/admin/payments";
import type { DonationStatus } from "@/services/wallet/walletTypes";

// Code-first (no Figma frame): 후원 운영 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "후원 운영 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUSES: DonationStatus[] = ["COMPLETED", "PROCESSING", "FAILED", "REFUNDING", "REFUNDED"];

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const raw = (await searchParams).status;
  const status = STATUSES.includes(raw as DonationStatus) ? (raw as DonationStatus) : null;
  const view = await getDonationsView({ status });
  if (!view) redirect("/admin/login");
  return <DonationsAdminScreen view={view} status={status} />;
}
