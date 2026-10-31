"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { LiveChannel } from "@/services/live/liveTypes";
import styles from "./CategoryChips.module.css";

export type LiveCategory = { id: string; name: string; count: number };

/** The categories of the channels on air, most lives first (FLEXTV's 방송 카테고리, phase 10). */
export function liveCategories(channels: LiveChannel[]): LiveCategory[] {
  const byId = new Map<string, LiveCategory>();
  for (const c of channels) {
    if (!c.category) continue;
    const entry = byId.get(c.category.id) ?? { ...c.category, count: 0 };
    entry.count += 1;
    byId.set(c.category.id, entry);
  }
  return [...byId.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
}

/**
 * 방송 카테고리 chips (code-first, funnation's live list): 전체 and each category on air. `value` null is 전체. Shared by
 * the home's 썸네이션 라이브 and `/live` with FLEXTV.
 */
export function CategoryChips({ categories, value, onChange, label }: { categories: LiveCategory[]; value: string | null; onChange: (id: string | null) => void; label?: string }) {
  const { t } = useI18n();
  return (
    <div className={styles.chips} role="group" aria-label={label ?? t("live.categories")}>
      {[{ id: null, name: t("live.allCategories") } as const, ...categories].map((c) => (
        <button key={c.id ?? "all"} type="button" className={styles.chip} aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}
