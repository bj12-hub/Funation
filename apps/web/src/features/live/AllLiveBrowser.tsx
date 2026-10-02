"use client";

import { useMemo, useState } from "react";
import type { LiveChannel } from "@/services/live/liveChannels";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import { LiveChannelCard } from "./LiveChannelCard";
import styles from "./live.module.css";

/** Cards revealed per "더 보기" step (funnation shows 12). */
const STEP = 12;

/**
 * 전체 방송 list — a four-column grid sorted by viewers with "더 보기 (보이는 수/전체)" (funnation structure).
 * No topic categories (2026-10-02 product decision); only the 방송 플랫폼 filter (confirmed platforms).
 * Filters the list already loaded for the page (TODO: server-side once the live list API exists).
 */
export function AllLiveBrowser({ channels }: { channels: LiveChannel[] }) {
  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const [shown, setShown] = useState(STEP);

  const visible = useMemo(
    () =>
      channels
        .filter((c) => platform === "ALL" || c.platform === platform)
        .sort((a, b) => b.viewerCount - a.viewerCount),
    [channels, platform]
  );

  return (
    <>
      <div className={styles.chipBar} role="group" aria-label="필터">
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
