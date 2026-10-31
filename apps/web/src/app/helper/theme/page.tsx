import type { Metadata } from "next";
import { ThemeGallery } from "@/features/overlayTheme/ThemeGallery";
import { getOverlayAppearance } from "@/services/creator/overlayTheme";
import styles from "@/features/helper/helper.module.css";
import { getT } from "@/lib/i18n/server";

// Code-first (no Figma frame): 전체 테마 (2026-10-08 오버레이 테마), on the helper domain.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("helperNav.theme") };
}
export const dynamic = "force-dynamic";

export default async function Page() {
  const [appearance, t] = await Promise.all([getOverlayAppearance(), getT()]);
  if (!appearance) return null;
  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>{t("helperNav.theme")}</h1>
        <p>{t("helper.themeIntro")}</p>
      </header>
      <ThemeGallery initial={appearance} />
    </div>
  );
}
