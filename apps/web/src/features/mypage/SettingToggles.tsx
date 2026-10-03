"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import {
  updateMarketingConsent,
  updateRankingVisibility,
  type RankingVisibilityKey,
  type UpdateResult
} from "@/services/account/myAccount";
import styles from "./mypage.module.css";

const SAVE_ERROR = "저장하지 못했습니다. 잠시 후 다시 시도해 주세요";

/** Saves one boolean setting: PROCESSING while saving, rolls back and shows ERROR on failure. */
function useSavedToggle(initial: boolean, save: (next: boolean) => Promise<UpdateResult>) {
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
      setError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return { value, busy, error, change };
}

const RANKING_ITEMS: { key: RankingVisibilityKey; label: string }[] = [
  { key: "quest", label: "퀘스트 랭킹 노출" },
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
  const toggle = useSavedToggle(initial, (next) => updateRankingVisibility(item.key, next));
  return (
    <div className={styles.rankingItem}>
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>{item.label}</span>
        <Toggle label={item.label} checked={toggle.value} busy={toggle.busy} onChange={toggle.change} />
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
  const label = "광고성 정보 수신 및 마케팅 활용 동의";
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
