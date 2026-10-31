import type { Metadata } from "next";
import { DonationLinkScreen } from "@/features/creatorStudio/widgets/DonationLinkScreen";
import { getBankSms } from "@/services/bankSms/bankSms";
import { getDonationLinks } from "@/services/creator/donationLink";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 후원 연동, on the helper domain — see docs/figma/code-first-screens.md
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.link") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [view, bank] = await Promise.all([getDonationLinks(), getBankSms()]);
  if (!view || !bank) return null;
  return <DonationLinkScreen view={view} bank={bank} />;
}
