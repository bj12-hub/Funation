"use client";

import Link from "next/link";
import { useState } from "react";
import type { PopularLiveSection } from "@/services/live/liveChannels";
import { LiveChannelCard } from "./LiveChannelCard";
import styles from "./live.module.css";

/** Cards shown per section before "더보기" (Figma 617:106). */
const INITIAL_COUNT = 4;

/** Figma 617:102 — category sections of 인기라이브 */
export function PopularLiveSections({ sections }: { sections: PopularLiveSection[] }) {
  const visibleSections = sections.filter((s) => s.channels.length > 0);

  if (visibleSections.length === 0) {
    return <p className={styles.empty}>지금 추천할 라이브 방송이 없습니다.</p>;
  }

  return (
    <div className={styles.popularList}>
      {visibleSections.map((section) => (
        <PopularSection key={section.category} section={section} />
      ))}
    </div>
  );
}

function PopularSection({ section }: { section: PopularLiveSection }) {
  const [expanded, setExpanded] = useState(false);
  const titleId = `popular-${section.category}`;
  const shown = expanded ? section.channels : section.channels.slice(0, INITIAL_COUNT);

  return (
    <section className={styles.popularSection} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.sectionTitle}>
        <Link href={`/live?category=${section.category}`}>{section.title} &gt;</Link>
      </h2>
      <div className={styles.popularGrid}>
        {shown.map((c) => (
          <LiveChannelCard key={c.id} channel={c} variant="compact" sizes="(max-width: 1200px) 50vw, 263px" />
        ))}
      </div>
      {!expanded && section.channels.length > INITIAL_COUNT && (
        <button type="button" className={styles.more} aria-expanded={false} onClick={() => setExpanded(true)}>
          더보기 <span className={styles.moreCaret}>▼</span>
        </button>
      )}
    </section>
  );
}
