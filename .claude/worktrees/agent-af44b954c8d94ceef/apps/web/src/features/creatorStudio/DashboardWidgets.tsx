"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import type { RankEntry } from "@/services/creator/creatorStudio";
import styles from "./studio.module.css";

const TABS = [
  { key: "day", label: "일간" },
  { key: "week", label: "주간" },
  { key: "month", label: "월간" }
] as const;

/** Figma 245:14 최근 후원 순위 — 일간 / 주간(기본) / 월간 top 5. */
export function RankingTabs({ rankings }: { rankings: Record<"day" | "week" | "month", RankEntry[]> }) {
  const [tab, setTab] = useState<"day" | "week" | "month">("week");
  const list = rankings[tab];
  return (
    <section className={styles.rankSection} aria-labelledby="creator-ranking">
      <h2 id="creator-ranking" className={styles.sectionTitle}>
        최근 후원 순위
      </h2>
      <div className={styles.rankTabs} role="tablist" aria-label="순위 기간">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.rankTab} ${tab === t.key ? styles.rankTabOn : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.card} role="tabpanel">
        {list.length === 0 ? (
          <p className={styles.empty}>아직 후원 순위가 없습니다.</p>
        ) : (
          <ol className={styles.rankList}>
            {list.map((r) => (
              <li key={r.rank} className={styles.rankRow}>
                <span className={styles.rankNo}>{r.rank}</span>
                <span className={styles.rankName}>{r.donor}</span>
                <span className={styles.money}>₩{formatNumber(r.amount)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/** "복사" / "열기" for the donation link (287:4). */
export function LinkActions({ url }: { url: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  return (
    <span className={styles.linkActions}>
      <button
        type="button"
        className={styles.miniButton}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied("done");
          } catch {
            setCopied("failed");
          }
          setTimeout(() => setCopied("idle"), 2000);
        }}
      >
        {copied === "done" ? "복사됨" : "복사"}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.miniButton}>
        열기
      </a>
      <span className={styles.srOnly} role="status">
        {copied === "done" ? "링크를 복사했습니다." : copied === "failed" ? "링크를 복사하지 못했습니다." : ""}
      </span>
    </span>
  );
}
