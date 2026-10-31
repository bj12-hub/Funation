import Image from "next/image";
import { getT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/Button";
import type { Promotion } from "@/services/home/homeFeed";
import styles from "./home.module.css";

/** Figma 727:2976 — event banner */
export async function PromoBanner({ promotion }: { promotion: Promotion }) {
  const t = await getT();
  return (
    <section className={styles.promo} aria-labelledby="home-promo">
      <Image src={promotion.imageUrl} alt="" fill sizes="(max-width: 1440px) 100vw, 1440px" className={styles.promoImage} />
      <div className={styles.promoInner}>
        <div className={styles.promoText}>
          <span className={styles.promoLabel}>{promotion.label}</span>
          <h2 id="home-promo" className={styles.promoTitle}>
            {promotion.title}
          </h2>
          <p className={styles.promoDescription}>{promotion.description}</p>
        </div>
        {promotion.href ? (
          <Button href={promotion.href} variant="light" size="lg" className={styles.promoCta}>
            {promotion.ctaLabel}
          </Button>
        ) : (
          // TODO: destination not defined in Figma yet.
          <Button variant="light" size="lg" className={styles.promoCta} aria-disabled="true" title={t("common.comingSoon")}>
            {promotion.ctaLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
