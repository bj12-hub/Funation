import type { Metadata } from "next";
import { PaymentsScreen } from "@/features/payments/PaymentScreens";
import { loadPayments } from "@/lib/queries";

export const metadata: Metadata = { title: "결제 · 환불 | Ssumnation 관리자" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const view = await loadPayments();
  if (!view) throw new Error("결제 내역을 불러오지 못했어요.");
  return <PaymentsScreen view={view} tab={(await searchParams).tab === "refunds" ? "refunds" : "charges"} />;
}
