import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";

// Figma: funnation-creators 4:7, funnation-all-creators-page 690:5
export const metadata: Metadata = { title: "인기 크리에이터 | Funation" };

export default function Page() {
  return <ComingSoon title="인기 크리에이터" />;
}
