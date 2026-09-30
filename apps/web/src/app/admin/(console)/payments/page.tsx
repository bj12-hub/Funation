import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaymentsScreen } from "@/features/admin/payments/PaymentScreens";
import { getPaymentsView } from "@/services/admin/payments";

// Code-first (no Figma frame): 결제 · 환불 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "결제 · 환불 | Somnation 관리자", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const view = await getPaymentsView();
  if (!view) redirect("/admin/login");
  return <PaymentsScreen view={view} tab={(await searchParams).tab === "refunds" ? "refunds" : "charges"} />;
}
