import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";

// Figma: (no screen in Figma yet)
export const metadata: Metadata = { title: "고객센터 | Funation" };

export default function Page() {
  return <ComingSoon title="고객센터" />;
}
