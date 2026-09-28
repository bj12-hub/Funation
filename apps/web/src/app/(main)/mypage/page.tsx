import type { Metadata } from "next";
import { ComingSoon } from "@/components/layout/ComingSoon";

// Figma: funnation-my-page 622:4, 735:4119
export const metadata: Metadata = { title: "마이페이지 | Funation" };

export default function Page() {
  return <ComingSoon title="마이페이지" />;
}
