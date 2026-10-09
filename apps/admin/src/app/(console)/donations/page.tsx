import type { Metadata } from "next";
import { DonationsAdminScreen } from "@/features/payments/PaymentScreens";
import { loadDonations } from "@/lib/queries";
import { DONATION_FILTERS, type DonationFilter } from "@/types/adminApi";

export const metadata: Metadata = { title: "후원 운영 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const raw = (await searchParams).status;
  const status = DONATION_FILTERS.includes(raw as DonationFilter) ? (raw as DonationFilter) : null;
  const view = await loadDonations(status);
  if (!view) throw new Error("후원 내역을 불러오지 못했어요.");
  return <DonationsAdminScreen view={view} status={status} />;
}
