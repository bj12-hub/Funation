import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegistrationForm } from "@/features/creatorStudio/settlement/RegistrationForm";
import { getSettlementOverview, hasAcceptedSettlementTerms } from "@/services/creator/settlement";
import { isMemberType } from "@/services/creator/settlementTypes";

// Figma: 정산 자료 등록 429:219 (개인) · 443:5 (외국인) · 433:210 (개인사업자) · 437:4 (법인)
export const metadata: Metadata = { title: "정산 자료 등록 | Funation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [overview, { type }] = await Promise.all([getSettlementOverview(), searchParams]);
  if (!overview) redirect("/login?role=creator&next=/creator/settlement/register");
  if (overview.registered) redirect("/creator/settlement/manage");
  // The form is only reachable after 이용동의 for the same member type.
  if (!isMemberType(type) || !(await hasAcceptedSettlementTerms(type))) {
    redirect(`/creator/settlement/register${isMemberType(type) ? `?type=${type}` : ""}`);
  }
  return <RegistrationForm memberType={type} />;
}
