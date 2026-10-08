import type { Metadata } from "next";
import { NotFoundView } from "@/components/layout/NotFoundView";

// Unmatched URLs (outside every route group): a standalone 404 with the brand and ways back.
export const metadata: Metadata = { title: "페이지를 찾을 수 없어요 | Ssumnation", robots: { index: false, follow: false } };

export default function NotFound() {
  return <NotFoundView standalone />;
}
