"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import {
  updateMarketingConsent,
  updateRankingVisibility,
  type RankingVisibilityKey,
  type UpdateResult
} from "@/services/account/myAccount";
import styles from "./mypage.module.css";

/** Saves one boolean setting: PROCESSING while saving, rolls back and shows ERROR on failure. */
function useSavedToggle(initial: boolean, save: (next: boolean) => Promise<UpdateResult>) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      const result = await save(next);
      if (result.status !== "SAVED") throw new Error("not saved");
    } catch {
      setValue(previous);
      setError(t("my.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return { value, busy, error, change };
}

const RANKING_ITEMS: { key: RankingVisibilityKey; label: MessageKey }[] = [
  { key: "quest", label: "my.questRanking" },
];

/** Figma 735:4292 ranking-card */
export function RankingVisibilitySettings({ initial }: { initial: Record<RankingVisibilityKey, boolean> }) {
  return (
    <div className={styles.rankingCard}>
      {RANKING_ITEMS.map((item) => (
        <RankingItem key={item.key} item={item} initial={initial[item.key]} />
      ))}
    </div>
  );
}

function RankingItem({ item, initial }: { item: (typeof RANKING_ITEMS)[number]; initial: boolean }) {
  const { t } = useI18n();
  const toggle = useSavedToggle(initial, (next) => updateRankingVisibility(item.key, next));
  const label = t(item.label);
  return (
    <div className={styles.rankingItem}>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>{label}</span>
        <Toggle label={label} checked={toggle.value} busy={toggle.busy} onChange={toggle.change} />
      </div>
      {toggle.error && (
        <p className={styles.toggleError} role="alert">
          {toggle.error}
        </p>
      )}
    </div>
  );
}

/** Figma 735:4347 marketing-card */
export function MarketingConsentSetting({ initial }: { initial: boolean }) {
  const { t } = useI18n();
  const label = t("my.marketingConsent");
  const toggle = useSavedToggle(initial, updateMarketingConsent);
  return (
    <div className={styles.marketingCard}>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>{label}</span>
        <Toggle label={label} checked={toggle.value} busy={toggle.busy} onChange={toggle.change} />
      </div>
      {toggle.error && (
        <p className={styles.toggleError} role="alert">
          {toggle.error}
        </p>
      )}
    </div>
  );
}
