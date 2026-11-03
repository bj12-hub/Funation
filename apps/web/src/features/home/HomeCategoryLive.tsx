"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryChips, liveCategories } from "@/features/live/CategoryChips";
import { LiveChannelCard } from "@/features/live/LiveChannelCard";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { LiveChannel } from "@/services/live/liveTypes";
import styles from "./homeFunnation.module.css";

/** Two rows of four, as funnation's home shows its own lives. */
const SHOWN = 8;

/**
 * 썸네이션 라이브 — the home's live block with FLEXTV (phase 10, code-first after funnation's renewed home): the streams
 * on air on FLEXTV, Ssumnation's broadcasting, with 방송 카테고리 chips, most viewers first, and 전체보기 to `/live` in the
 * same category. Funnation's second row, 유튜브 라이브, has no source with FLEXTV yet (TBD).
 */
export function HomeCategoryLive({ channels }: { channels: LiveChannel[] }) {
  const { t } = useI18n();
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => liveCategories(channels), [channels]);
  const shown = useMemo(
    () => channels.filter((c) => category === null || c.category?.id === category).sort((a, b) => b.viewerCount - a.viewerCount),
    [channels, category]
  );

  return (
    <section className={styles.block} aria-labelledby="home-ssumnation-live">
      <div className={styles.blockHead}>
        <h2 id="home-ssumnation-live" className={styles.blockTitleLarge}>
          {t("home.ssumnationLive")}
        </h2>
        <Link href={category ? `/live?category=${encodeURIComponent(category)}` : "/live"} className={styles.textButton}>
          {t("home.viewAllArrow")}
        </Link>
      </div>
      {categories.length > 0 && <CategoryChips categories={categories} value={category} onChange={setCategory} />}
      {shown.length === 0 ? (
        <p className={styles.empty}>{t("home.noLive")}</p>
      ) : (
        <div className={styles.grid}>
          {shown.slice(0, SHOWN).map((c) => (
            <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 900px) 50vw, 25vw" />
          ))}
        </div>
      )}
    </section>
  );
}
