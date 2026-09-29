"use client";

import { useMemo, useState } from "react";
import { LIVE_CATEGORY_LABEL, type LiveCategory, type LiveChannel } from "@/services/live/liveChannels";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { LiveChannelCard } from "./LiveChannelCard";
import styles from "./live.module.css";

/** Chip emoji per category (display only), in the funnation 전체 방송 style. */
const CATEGORY_EMOJI: Record<LiveCategory, string> = {
  NEWS_ECONOMY: "📰",
  MUSIC_DANCE: "🎤",
  GAME: "🎮",
  DAILY_TRAVEL: "🏕️",
  FINANCE: "💹",
  MUKBANG: "🍚",
  TALK: "💬",
  SPORTS: "⚽",
  VARIETY: "🎉",
  VIRTUAL: "⭐"
};

/** Cards revealed per "더 보기" step (funnation shows 12). */
const STEP = 12;

type AllLiveBrowserProps = {
  channels: LiveChannel[];
  /** From `?category=` (e.g. the home category rows). */
  initialCategory?: LiveCategory;
};

/**
 * 전체 방송 list — structure follows funnation: 전체 + category chips, a four-column grid sorted by
 * viewers, and "더 보기 (보이는 수/전체)". The 방송 플랫폼 filter is ours (confirmed platforms).
 * Filters the list already loaded for the page (TODO: server-side once the live list API exists).
 */
export function AllLiveBrowser({ channels, initialCategory }: AllLiveBrowserProps) {
  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const [category, setCategory] = useState<LiveCategory | null>(initialCategory ?? null);
  const [shown, setShown] = useState(STEP);

  const visible = useMemo(
    () =>
      channels
        .filter((c) => (platform === "ALL" || c.platform === platform) && (!category || c.category === category))
        .sort((a, b) => b.viewerCount - a.viewerCount),
    [channels, platform, category]
  );

  const pick = (c: LiveCategory | null) => {
    setCategory(c);
    setShown(STEP);
  };

  return (
    <>
      <div className={styles.chipBar} role="group" aria-label="카테고리">
        <button type="button" className={`${styles.chip} ${!category ? styles.chipActive : ""}`} aria-pressed={!category} onClick={() => pick(null)}>
          전체
        </button>
        {(Object.keys(LIVE_CATEGORY_LABEL) as LiveCategory[]).map((c) => (
          <button key={c} type="button" className={`${styles.chip} ${category === c ? styles.chipActive : ""}`} aria-pressed={category === c} onClick={() => pick(c)}>
            <span aria-hidden="true">{CATEGORY_EMOJI[c]}</span> {LIVE_CATEGORY_LABEL[c]}
          </button>
        ))}
        <select
          className={`${styles.control} ${styles.platformSelect}`}
          aria-label="방송 플랫폼"
          value={platform}
          onChange={(e) => {
            setPlatform(e.target.value as Platform | "ALL");
            setShown(STEP);
          }}
        >
          <option value="ALL">모든 플랫폼</option>
          {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
      </div>

      <section className={styles.section} aria-label="방송 중인 채널">
        {visible.length === 0 ? (
          <p className={styles.empty}>{channels.length === 0 ? "지금 방송 중인 채널이 없습니다." : "조건에 맞는 방송이 없습니다."}</p>
        ) : (
          <>
            <div className={styles.grid4}>
              {visible.slice(0, shown).map((c) => (
                <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 900px) 50vw, 25vw" />
              ))}
            </div>
            {shown < visible.length && (
              <button type="button" className={styles.more} onClick={() => setShown((n) => n + STEP)}>
                더 보기 ({Math.min(shown, visible.length)}/{visible.length})
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
