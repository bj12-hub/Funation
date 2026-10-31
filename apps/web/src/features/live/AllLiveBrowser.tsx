"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { LiveChannel } from "@/services/live/liveChannels";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { CategoryChips, liveCategories } from "./CategoryChips";
import { LiveChannelCard } from "./LiveChannelCard";
import styles from "./live.module.css";

/** Cards revealed per "더 보기" step (funnation shows 12). */
const STEP = 12;

/**
 * 전체 방송 list — a four-column grid sorted by viewers with "더 보기 (보이는 수/전체)" (funnation structure).
 * No topic categories (2026-10-02 product decision); only the 방송 플랫폼 filter (confirmed platforms).
 * Filters the list already loaded for the page (TODO: server-side once the live list API exists).
 * `byCategory` (FLEXTV, phase 10, funnation's renewal): every live is FLEXTV's, so FLEXTV's 방송 카테고리 chips and a
 * sort (시청자순 · 최신순) take the platform filter's place; `initialCategory` comes from `?category=`.
 */
export function AllLiveBrowser({ channels, byCategory = false, initialCategory = null }: { channels: LiveChannel[]; byCategory?: boolean; initialCategory?: string | null }) {
  const { t } = useI18n();
  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const categories = useMemo(() => (byCategory ? liveCategories(channels) : []), [byCategory, channels]);
  const [category, setCategory] = useState<string | null>(categories.some((c) => c.id === initialCategory) ? initialCategory : null);
  const [sort, setSort] = useState<"viewers" | "recent">("viewers");
  const [shown, setShown] = useState(STEP);

  const visible = useMemo(
    () =>
      channels
        .filter((c) => (byCategory ? category === null || c.category?.id === category : platform === "ALL" || c.platform === platform))
        .sort((a, b) => (sort === "recent" ? a.elapsedSeconds - b.elapsedSeconds : b.viewerCount - a.viewerCount)),
    [channels, byCategory, category, platform, sort]
  );

  if (byCategory) {
    return (
      <>
        <div className={styles.chipBar}>
          <CategoryChips
            categories={categories}
            value={category}
            onChange={(id) => {
              setCategory(id);
              setShown(STEP);
            }}
          />
          <select className={`${styles.control} ${styles.platformSelect}`} aria-label={t("live.sort")} value={sort} onChange={(e) => setSort(e.target.value as "viewers" | "recent")}>
            <option value="viewers">{t("live.sortViewers")}</option>
            <option value="recent">{t("live.sortRecent")}</option>
          </select>
        </div>
        <LiveGrid channels={channels} visible={visible} shown={shown} onMore={() => setShown((n) => n + STEP)} />
      </>
    );
  }

  return (
    <>
      <div className={styles.chipBar} role="group" aria-label={t("live.filter")}>
        <select
          className={`${styles.control} ${styles.platformSelect}`}
          aria-label={t("live.platform")}
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value as Platform | "ALL");
            setShown(STEP);
          }}
        >
          <option value="ALL">{t("live.allPlatforms")}</option>
          {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <LiveGrid channels={channels} visible={visible} shown={shown} onMore={() => setShown((n) => n + STEP)} />
    </>
  );
}

function LiveGrid({ channels, visible, shown, onMore }: { channels: LiveChannel[]; visible: LiveChannel[]; shown: number; onMore: () => void }) {
  const { t } = useI18n();
  return (
    <section className={styles.section} aria-label={t("live.channelsAria")}>
      {visible.length === 0 ? (
        <p className={styles.empty}>{channels.length === 0 ? t("live.noneLive") : t("live.noMatch")}</p>
      ) : (
        <>
          <div className={styles.grid4}>
            {visible.slice(0, shown).map((c, i) => (
              <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 900px) 50vw, 25vw" priority={i < 4} />
            ))}
          </div>
          {shown < visible.length && (
            <button type="button" className={styles.more} onClick={onMore}>
              {t("live.more", { shown: Math.min(shown, visible.length), total: visible.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}
