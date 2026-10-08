"use client";

import Image from "next/image";
import { useState } from "react";
import type { PopularCreator } from "@/services/home/homeFeed";
import { CreatorProfilePopup } from "./CreatorProfilePopup";
import styles from "./homeFunnation.module.css";

/**
 * 요즘 인기 많은 크리에이터 strip — home top section (funnation structure). A horizontal row of creator
 * avatars; 새로고침 reshuffles the order (the server list is already ranked; shuffling is display only).
 * A creator opens the profile popup (Figma 688:646), which links to the creator room.
 */
export function CreatorStrip({ creators }: { creators: PopularCreator[] }) {
  const [order, setOrder] = useState(creators);
  const [selected, setSelected] = useState<PopularCreator | null>(null);

  const reshuffle = () =>
    setOrder((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });

  return (
    <section className={styles.block} aria-labelledby="home-creator-strip">
      <div className={styles.blockHead}>
        <h2 id="home-creator-strip" className={styles.blockTitle}>
          요즘 인기 많은 크리에이터에게 후원하세요!
        </h2>
        {order.length > 1 && (
          <button type="button" className={styles.textButton} onClick={reshuffle}>
            ↻ 새로고침
          </button>
        )}
      </div>
      {order.length === 0 ? (
        <p className={styles.empty}>표시할 크리에이터가 없습니다.</p>
      ) : (
        <ul className={styles.strip}>
          {order.map((c) => (
            <li key={c.id}>
              <button type="button" className={styles.stripItem} aria-haspopup="dialog" onClick={() => setSelected(c)}>
                <span className={styles.stripRing}>
                  <Image src={c.avatarUrl} alt="" width={64} height={64} className={styles.stripAvatar} />
                </span>
                <span className={styles.stripName}>{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <CreatorProfilePopup creator={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
