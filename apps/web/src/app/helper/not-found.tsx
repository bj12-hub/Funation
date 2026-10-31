import type { Metadata } from "next";
import { HelperNotFound } from "@/features/helper/HelperNotFound";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helper.metaNotFound"), robots: { index: false, follow: false } };
}

export default function NotFound() {
  return <HelperNotFound />;
}
