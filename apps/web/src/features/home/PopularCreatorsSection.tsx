"use client";

import Image from "next/image";
import { useState } from "react";
import { formatCompactKo } from "@/lib/format";
import type { PopularCreator } from "@/services/home/homeFeed";
import { CreatorProfilePopup } from "./CreatorProfilePopup";
import { SectionHeader } from "./SectionHeader";
import styles from "./home.module.css";

/** Figma 727:2931 — ✨ LIVE 인기 크리에이터. A creator opens the 688:646 profile popup (709:2). */
export function PopularCreatorsSection({ creators }: { creators: PopularCreator[] }) {
  const [selected, setSelected] = useState<PopularCreator | null>(null);

  return (
    <section className={styles.section} aria-labelledby="home-creators">
      <SectionHeader id="home-creators" title="✨ LIVE 인기 크리에이터" viewAllHref="/creators" />
      {creators.length === 0 ? (
        <p className={styles.empty}>표시할 크리에이터가 없습니다.</p>
      ) : (
        <ul className={styles.creatorGrid}>
          {creators.map((creator) => (
            <li key={creator.id}>
              <button type="button" className={styles.creator} aria-haspopup="dialog" onClick={() => setSelected(creator)}>
                <span className={styles.creatorRing}>
                  <Image src={creator.avatarUrl} alt="" width={104} height={104} className={styles.creatorAvatar} />
                </span>
                <span className={styles.creatorText}>
                  <span className={styles.creatorName}>{creator.name}</span>
                  <span className={styles.creatorSubs}>구독자 {formatCompactKo(creator.subscriberCount)}명</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <CreatorProfilePopup creator={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
