import type { Metadata } from "next";
import { RemoteGuide } from "@/features/helper/RemoteGuide";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 라이브 방송 리모컨 가이드 (legacy FlexTV 도우미 "라이브 방송 리모컨 가이드").
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helper.remoteGuide") };
}

export default function Page() {
  return <RemoteGuide />;
}
