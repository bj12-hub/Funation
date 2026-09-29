import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationLinkScreen } from "@/features/creatorStudio/widgets/DonationLinkScreen";
import { getDonationLinks } from "@/services/creator/donationLink";

// Code-first (no Figma frame): 후원 연동 — see docs/figma/code-first-screens.md
export const metadata: Metadata = { title: "후원 연동 | Somnation 크리에이터" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const view = await getDonationLinks();
  if (!view) redirect("/login?role=creator&next=/creator/widgets/link");
  return <DonationLinkScreen view={view} />;
}
