"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { goalPercent, type CrewPublic } from "@/services/crew/crewTypes";
import styles from "./pledge.module.css";

/**
 * A crew member's BJ 공약 (code-first, StreamDonate BJ 공약 참고 — 2026-10-25): the 공약 text and, with a goal while a crew
 * broadcast is live, how far the member's score is (the same score as the OBS gauge). Nothing without a 공약.
 */
export function PledgeLine({ member, compact = false }: { member: CrewPublic["members"][number]; compact?: boolean }) {
  const { t } = useI18n();
  const p = member.pledge;
  if (!p) return null;
  const progress = p.goal > 0 && member.score !== null ? goalPercent(member.score, p.goal) : null;
  return (
    <span className={styles.pledge} data-compact={compact ? "" : undefined}>
      {p.text && (
        <span className={styles.text}>
          <b>{t("room.pledge")}</b> {p.text}
        </span>
      )}
      {p.goal > 0 && (
        <span className={styles.goal}>
          {progress === null ? (
            t("room.pledgeGoal", { goal: formatNumber(p.goal) })
          ) : (
            <>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${progress}%`, background: member.color }} />
              </span>
              {progress >= 100 ? t("room.pledgeReached") : t("room.pledgeProgress", { score: formatNumber(member.score!), goal: formatNumber(p.goal) })}
            </>
          )}
        </span>
      )}
    </span>
  );
}
