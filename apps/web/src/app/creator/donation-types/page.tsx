import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DonationTypesScreen } from "@/features/creatorStudio/donationTypes/DonationTypesScreen";
import { FLEXTV_SSUMNATION_API } from "@/lib/flextv/mode";
import { getT } from "@/lib/i18n/server";
import { getDonationTypeSettings } from "@/services/creator/flextvDonationTypes";

// Code-first (no Figma frame): 후원 종류 설정 on FLEXTV channels (phase 6).
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("flextvDonationTypes.metaTitle") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  // The settings live on FLEXTV's Ssumnation endpoints; without them there is nothing to set here.
  if (!FLEXTV_SSUMNATION_API) notFound();
  const settings = await getDonationTypeSettings();
  if (!settings) redirect("/login?role=creator&next=/creator/donation-types");
  return <DonationTypesScreen initial={settings} />;
}
