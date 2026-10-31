import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DonationLinkScreen } from "@/features/creatorStudio/widgets/DonationLinkScreen";
import { getT } from "@/lib/i18n/server";
import { getBankSms } from "@/services/bankSms/bankSms";
import { getDonationLinks } from "@/services/creator/donationLink";

// Code-first (no Figma frame): 후원 연동 — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("studioToolsLink.meta") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, bank] = await Promise.all([getDonationLinks(), getBankSms()]);
  if (!view || !bank) redirect("/login?role=creator&next=/creator/widgets/link");
  return <DonationLinkScreen view={view} bank={bank} />;
}
