"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatKstDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { unblock } from "@/services/moderation/moderation";
import type { BlockEntry } from "@/services/moderation/moderationTypes";
import styles from "./moderation.module.css";

/** 차단 관리 — code-first (no Figma frame). Route `/mypage/blocks`. */
export function BlocksScreen({ blocks }: { blocks: BlockEntry[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const release = (b: BlockEntry) =>
    startTransition(async () => {
      try {
        const res = await unblock(b.id);
        setNote(res.status === "OK" ? t("moderation.unblocked", { name: res.name }) : t("moderation.alreadyUnblocked"));
        router.refresh();
      } catch {
        setNote(t("moderation.unblockFailed"));
      }
    });

  return (
    <div className={styles.page}>
      <Link href="/mypage" className={styles.back}>
        {t("moderation.backToMy")}
      </Link>
      <h1 className={styles.title}>{t("moderation.blocksTitle")}</h1>
      <p className={styles.muted}>{t("moderation.blocksNote")}</p>
      {blocks.length === 0 ? (
        <p className={styles.empty}>{t("moderation.blocksEmpty")}</p>
      ) : (
        <ul className={styles.blockList}>
          {blocks.map((b) => (
            <li key={b.id} className={styles.blockItem}>
              <span className={styles.blockName}>{b.name}</span>
              <span className={styles.muted}>{t("moderation.blockedOn", { date: formatKstDate(b.since) })}</span>
              <button type="button" className={styles.unblock} disabled={pending} onClick={() => release(b)}>
                {t("moderation.unblock")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className={styles.muted} role="status">
          {note}
        </p>
      )}
    </div>
  );
}
