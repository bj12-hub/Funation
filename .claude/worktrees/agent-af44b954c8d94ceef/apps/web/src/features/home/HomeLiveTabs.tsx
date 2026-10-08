"use client";

import Link from "next/link";
import { useState } from "react";
import { LiveChannelCard } from "@/features/live/LiveChannelCard";
import { POPULAR_LIVE_COUNT, type LiveChannel } from "@/services/live/liveChannels";
import styles from "./homeFunnation.module.css";

/** Cards per row on the home (funnation shows four). */
const PER_ROW = 4;

/**
 * 전체 방송 — home live block (funnation structure). Tabs:
 * - 인기 라이브: the most watched live channels (no topic categories — 2026-10-02 product decision).
 * - 전체 라이브: every live channel by viewers, linking to /live.
 */
export function HomeLiveTabs({ channels }: { channels: LiveChannel[] }) {
  const [tab, setTab] = useState<"popular" | "all">("popular");
  const all = [...channels].sort((a, b) => b.viewerCount - a.viewerCount);
  const popular = all.slice(0, POPULAR_LIVE_COUNT);

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
          {popular.length > 0 ? (
            <LiveRow id="home-row-popular" title="지금 가장 많이 보는 라이브" href="/live/popular" channels={popular} />
          ) : (
            <p className={styles.empty}>진행 중인 라이브 방송이 없습니다.</p>
          )}
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
