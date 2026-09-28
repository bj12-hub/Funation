import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";

// Figma: funnation-all-live-page 617:316, funnation-popular-live-page 617:5
export const metadata: Metadata = { title: "LIVE | Funation" };

export default function Page() {
  return <ComingSoon title="LIVE" />;
}
