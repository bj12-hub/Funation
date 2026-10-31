import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { SiteBanner as SiteBannerData } from "@/services/system/siteBanner";
import styles from "./SiteBanner.module.css";

/** 사이트 공지 배너 — code-first. Set by operators in 관리자 › 시스템 (점검 · 장애 안내). */
export async function SiteBanner({ banner }: { banner: Pick<SiteBannerData, "level" | "message" | "href"> }) {
  const t = await getT();
  return (
    <div className={styles.banner} data-level={banner.level} role={banner.level === "WARNING" ? "alert" : "status"}>
      <span aria-hidden="true">{banner.level === "WARNING" ? "⚠️" : "📢"}</span>
      <span className={styles.text}>{banner.message}</span>
      {banner.href && (
        <Link href={banner.href} className={styles.link}>
          {t("common.bannerMore")}
        </Link>
      )}
    </div>
  );
}
