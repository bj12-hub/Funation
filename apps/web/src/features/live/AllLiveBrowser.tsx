"use client";

import { useMemo, useState } from "react";
import { SearchSmallIcon } from "@/components/icons";
import { LIVE_CATEGORY_LABEL, type LiveCategory, type LiveChannel } from "@/services/live/liveChannels";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { LiveChannelCard } from "./LiveChannelCard";
import styles from "./live.module.css";

/** Category chips shown in Figma 617:414. */
const CATEGORY_CHIPS: LiveCategory[] = ["MUKBANG", "TALK", "GAME"];

// Options for the 크리에이터 ▼ and 시청자 높은순 ▼ dropdowns are not specified in Figma (TBD).
type SearchField = "creator" | "title";
type Sort = "viewers-desc" | "viewers-asc" | "recent";

type AllLiveBrowserProps = {
  channels: LiveChannel[];
  /** From `?category=` (e.g. the 인기라이브 section headers). */
  initialCategory?: LiveCategory;
};

/**
 * 전체라이브 filter bar (617:413) + grid (617:433).
 * Filters the list already loaded for the page.
 * TODO: move filtering, search and sorting to the server once the live list API exists.
 */
export function AllLiveBrowser({ channels, initialCategory }: AllLiveBrowserProps) {
  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const [category, setCategory] = useState<LiveCategory | null>(initialCategory ?? null);
  const [field, setField] = useState<SearchField>("creator");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("viewers-desc");

  const chips = category && !CATEGORY_CHIPS.includes(category) ? [...CATEGORY_CHIPS, category] : CATEGORY_CHIPS;

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = channels.filter(
      (c) =>
        (platform === "ALL" || c.platform === platform) &&
        (!category || c.category === category) &&
        (!keyword || (field === "creator" ? c.channelName : c.title).toLowerCase().includes(keyword))
    );
    return filtered.sort((a, b) => {
      if (sort === "viewers-asc") return a.viewerCount - b.viewerCount;
      if (sort === "recent") return a.elapsedSeconds - b.elapsedSeconds;
      return b.viewerCount - a.viewerCount;
    });
  }, [channels, platform, category, field, query, sort]);

  return (
    <>
      <div className={styles.filterBar} role="search" aria-label="라이브 필터">
        <div className={styles.filterGroup}>
          <select
            className={`${styles.control} ${styles.controlStrong}`}
            aria-label="방송 플랫폼"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform | "ALL")}
          >
            <option value="ALL">방송 플랫폼</option>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
          <span className={styles.chipLabel} id="live-category-label">
            추천 카테고리
          </span>
          <div className={styles.filterGroup} role="group" aria-labelledby="live-category-label">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                className={`${styles.chip} ${category === c ? styles.chipActive : ""}`}
                aria-pressed={category === c}
                onClick={() => setCategory(category === c ? null : c)}
              >
                {LIVE_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>

        <div className={`${styles.filterGroup} ${styles.searchGroup}`}>
          <select className={styles.control} aria-label="검색 대상" value={field} onChange={(e) => setField(e.target.value as SearchField)}>
            <option value="creator">크리에이터</option>
            <option value="title">방송 제목</option>
          </select>
          <label className={styles.search}>
            <SearchSmallIcon />
            <input
              type="search"
              className={styles.searchInput}
              placeholder={field === "creator" ? "크리에이터 검색" : "방송 제목 검색"}
              aria-label={field === "creator" ? "크리에이터 검색" : "방송 제목 검색"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        <select className={styles.control} aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="viewers-desc">시청자 높은순</option>
          <option value="viewers-asc">시청자 낮은순</option>
          <option value="recent">최근 시작순</option>
        </select>
      </div>

      <section className={styles.section} aria-labelledby="live-all-title">
        <div className={styles.sectionHeader}>
          <h2 id="live-all-title" className={styles.sectionTitle}>
            📺 전체 생방송 채널
          </h2>
          <span className={styles.sectionCount}>{visible.length}개 채널 방송 중</span>
        </div>
        {visible.length === 0 ? (
          <p className={styles.empty}>
            {channels.length === 0 ? "지금 방송 중인 채널이 없습니다." : "조건에 맞는 방송이 없습니다."}
          </p>
        ) : (
          <div className={styles.grid}>
            {visible.map((c) => (
              <LiveChannelCard key={c.id} channel={c} variant="full" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 351px" />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
