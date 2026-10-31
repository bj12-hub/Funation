"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { RankEntry } from "@/services/creator/creatorStudio";
import styles from "./studio.module.css";

const TABS = [
  { key: "day", label: "studioDashboard.day" },
  { key: "week", label: "studioDashboard.week" },
  { key: "month", label: "studioDashboard.month" }
] as const;

/** Figma 245:14 최근 후원 순위 — 일간 / 주간(기본) / 월간 top 5. */
export function RankingTabs({ rankings }: { rankings: Record<"day" | "week" | "month", RankEntry[]> }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"day" | "week" | "month">("week");
  const list = rankings[tab];
  return (
    <section className={styles.rankSection} aria-labelledby="creator-ranking">
      <h2 id="creator-ranking" className={styles.sectionTitle}>
        {t("studioDashboard.ranking")}
      </h2>
      <div className={styles.rankTabs} role="tablist" aria-label={t("studioDashboard.rankingPeriod")}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`${styles.rankTab} ${tab === item.key ? styles.rankTabOn : ""}`}
            onClick={() => setTab(item.key)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>
      <div className={styles.card} role="tabpanel">
        {list.length === 0 ? (
          <p className={styles.empty}>{t("studioDashboard.rankingEmpty")}</p>
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
  const { t } = useI18n();
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
        {copied === "done" ? t("studioDashboard.copied") : t("studioDashboard.copy")}
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.miniButton}>
        {t("studioDashboard.open")}
      </a>
      <span className={styles.srOnly} role="status">
        {copied === "done" ? t("studioDashboard.linkCopied") : copied === "failed" ? t("studioDashboard.linkCopyFailed") : ""}
      </span>
    </span>
  );
}
