import type { Metadata } from "next";
import { RemoteGuide } from "@/features/helper/RemoteGuide";

// Code-first (no Figma frame): 라이브 방송 리모컨 가이드 (legacy FlexTV 도우미 "라이브 방송 리모컨 가이드").
export const metadata: Metadata = { title: "리모컨 가이드" };

export default function Page() {
  return <RemoteGuide />;
}
