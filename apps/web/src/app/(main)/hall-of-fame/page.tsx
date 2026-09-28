import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";

// Figma: funnation-hall-of-fame 3:637
export const metadata: Metadata = { title: "명예의 전당 | Funation" };

export default function Page() {
  return <ComingSoon title="명예의 전당" />;
}
