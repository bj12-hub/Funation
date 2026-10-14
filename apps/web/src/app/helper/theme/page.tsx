import type { Metadata } from "next";
import { ThemeGallery } from "@/features/overlayTheme/ThemeGallery";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";
import styles from "@/features/helper/helper.module.css";

// Code-first (no Figma frame): 전체 테마 (2026-10-08 오버레이 테마), on the helper domain.
export const metadata: Metadata = { title: "전체 테마" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const appearance = await getOverlayAppearance();
  if (!appearance) return null;
  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>전체 테마</h1>
        <p>모든 방송 화면 위젯이 기본으로 쓰는 테마와 포인트 색이에요. 위젯마다 다른 테마를 고르면 그 위젯만 바뀌어요.</p>
      </header>
      <ThemeGallery initial={appearance} />
    </div>
  );
}
