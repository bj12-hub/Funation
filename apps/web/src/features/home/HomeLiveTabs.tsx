"use client";

import Link from "next/link";
import { useState } from "react";
import { LiveChannelCard } from "@/features/live/LiveChannelCard";
import { LIVE_CATEGORY_LABEL, type LiveCategory, type LiveChannel, type PopularLiveSection } from "@/services/live/liveChannels";
import styles from "./homeFunnation.module.css";

/** Cards per row on the home (funnation shows four). */
const PER_ROW = 4;

/** Title emoji per category (display only). */
const CATEGORY_EMOJI: Partial<Record<LiveCategory, string>> = { MUSIC_DANCE: "🎤", TALK: "💬", VIRTUAL: "🎮", GAME: "🕹️", VARIETY: "🎉" };

/**
 * 전체 방송 — home live block (funnation structure). Tabs:
 * - 인기 라이브: "{카테고리} 추천 라이브" rows from the recommended sections, then 그 외 라이브
 *   (live channels outside those categories). Each row links to /live filtered by category.
 * - 전체 라이브: every live channel by viewers, linking to /live.
 */
export function HomeLiveTabs({ sections, channels }: { sections: PopularLiveSection[]; channels: LiveChannel[] }) {
  const [tab, setTab] = useState<"popular" | "all">("popular");
  const rows = sections.filter((s) => s.channels.length > 0);
  const covered = new Set(rows.map((s) => s.category));
  const others = channels.filter((c) => !covered.has(c.category)).sort((a, b) => b.viewerCount - a.viewerCount);
  const all = [...channels].sort((a, b) => b.viewerCount - a.viewerCount);

  return (
    <section className={styles.block} aria-labelledby="home-all-live">
      <div className={styles.blockHead}>
        <h2 id="home-all-live" className={styles.blockTitleLarge}>
          전체 방송
        </h2>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="전체 방송">
        {(
          [
            ["popular", "인기 라이브"],
            ["all", "전체 라이브"]
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={styles.tab} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "popular" ? (
        <div className={styles.rows} role="tabpanel">
          {rows.map((s) => (
            <LiveRow
              key={s.category}
              id={`home-row-${s.category}`}
              title={`${LIVE_CATEGORY_LABEL[s.category]} 추천 라이브 ${CATEGORY_EMOJI[s.category] ?? ""}`.trim()}
              href={`/live?category=${s.category}`}
              channels={s.channels.slice(0, PER_ROW)}
            />
          ))}
          {others.length > 0 && <LiveRow id="home-row-others" title="그 외 라이브" href="/live" channels={others.slice(0, PER_ROW)} />}
          {rows.length === 0 && others.length === 0 && <p className={styles.empty}>진행 중인 라이브 방송이 없습니다.</p>}
        </div>
      ) : (
        <div role="tabpanel">
          {all.length === 0 ? (
            <p className={styles.empty}>진행 중인 라이브 방송이 없습니다.</p>
          ) : (
            <>
              <div className={styles.grid}>
                {all.slice(0, PER_ROW * 3).map((c) => (
                  <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 900px) 50vw, 25vw" />
                ))}
              </div>
              <Link href="/live" className={styles.moreLink}>
                전체 라이브 보기 ›
              </Link>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function LiveRow({ id, title, href, channels }: { id: string; title: string; href: string; channels: LiveChannel[] }) {
  return (
    <section aria-labelledby={id} className={styles.row}>
      <div className={styles.blockHead}>
        <h3 id={id} className={styles.rowTitle}>
          {title}
        </h3>
        <Link href={href} className={styles.textButton}>
          전체보기 ›
        </Link>
      </div>
      <div className={styles.grid}>
        {channels.map((c) => (
          <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 900px) 50vw, 25vw" />
        ))}
      </div>
    </section>
  );
}
