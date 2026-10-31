import type { Metadata } from "next";
import { NotFoundView } from "@/components/layout/NotFoundView";
import { HelperFrame } from "@/features/helper/HelperLanding";
import { HelperNotFound } from "@/features/helper/HelperNotFound";
import { getT } from "@/lib/i18n/server";
import { getSurface } from "@/lib/surface";

// Unmatched URLs (outside every route group): a standalone 404 with the brand and ways back.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t("page.notFoundTitle")} | Ssumnation`, robots: { index: false, follow: false } };
}

export default async function NotFound() {
  if ((await getSurface()) === "helper") {
    return (
      <HelperFrame>
        <HelperNotFound />
      </HelperFrame>
    );
  }
  return <NotFoundView standalone />;
}
