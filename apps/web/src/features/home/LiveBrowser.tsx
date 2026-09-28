"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { formatCompactKo } from "@/lib/format";
import type { LiveBroadcast, LiveCategory, Platform } from "@/services/home/homeFeed";
import { SectionHeader } from "./SectionHeader";
import shared from "./home.module.css";
import styles from "./LiveBrowser.module.css";

const CATEGORIES: { value: LiveCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "VARIETY", label: "예능" },
  { value: "DRAMA", label: "드라마" },
  { value: "SPORTS", label: "스포츠" },
  { value: "MUSIC", label: "뮤직" },
  { value: "GAME", label: "게임" },
  { value: "MUKBANG", label: "먹방" },
  { value: "DAILY", label: "일상" }
];

const PLATFORM_LABEL: Record<Platform, string> = {
  YOUTUBE: "YouTube Live",
  FLEXTV: "FlexTV",
  SOOP: "SOOP"
};

/**
 * Figma 727:2984 (관심사 카테고리) + 727:3009 (📺 현재 라이브 방송).
 * Filters the broadcasts already loaded with the home feed.
 * TODO: move filtering/search to the server once the live list API exists.
 */
export function LiveBrowser({ broadcasts }: { broadcasts: LiveBroadcast[] }) {
  const [category, setCategory] = useState<LiveCategory | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return broadcasts.filter(
      (b) =>
        (category === "ALL" || b.category === category) &&
        (!keyword || b.channelName.toLowerCase().includes(keyword) || b.title.toLowerCase().includes(keyword))
    );
  }, [broadcasts, category, query]);

  return (
    <>
      <section className={`${shared.section} ${styles.filters}`} aria-labelledby="home-categories">
        <h2 id="home-categories" className={styles.filtersTitle}>
          관심사 카테고리
        </h2>
        <div className={styles.filterRow}>
          <div className={styles.tabs} role="group" aria-label="카테고리">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`${styles.tab} ${category === c.value ? styles.tabActive : ""}`}
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <SearchIcon />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="크리에이터 검색"
              aria-label="크리에이터 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={`${shared.section} ${styles.grid}`} aria-labelledby="home-live">
        <SectionHeader id="home-live" title="📺 현재 라이브 방송" viewAllHref="/live" />
        {visible.length === 0 ? (
          <p className={shared.empty}>
            {broadcasts.length === 0 ? "진행 중인 라이브 방송이 없습니다." : "조건에 맞는 라이브 방송이 없습니다."}
          </p>
        ) : (
          <div className={styles.cards}>
            {visible.map((b) => (
              <Link key={b.id} href={b.href} className={shared.card}>
                <div className={shared.thumb}>
                  <Image src={b.thumbnailUrl} alt="" fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 405px" className={shared.thumbImage} />
                  <span className={shared.thumbShade} />
                  <span className={styles.liveBadge}>LIVE</span>
                  <span className={styles.liveInfo}>
                    <strong>{formatCompactKo(b.viewerCount)} 시청 중</strong>
                    <span>{PLATFORM_LABEL[b.platform]}</span>
                  </span>
                </div>
                <div className={shared.cardInfo}>
                  <Image src={b.channelAvatarUrl} alt="" width={36} height={36} className={styles.avatar} />
                  <div className={shared.cardText}>
                    <h3 className={shared.cardTitle}>{b.title}</h3>
                    <div className={shared.cardMeta}>
                      <span>{b.channelName}</span>
                      <span className={shared.cardMetaSub}>라이브 진행 중</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
