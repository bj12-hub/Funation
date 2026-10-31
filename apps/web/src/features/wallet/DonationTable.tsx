import Link from "next/link";
import { formatNumber, kstIsoString } from "@/lib/format";
import { QuestDecide } from "@/features/donations/QuestDecide";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { messagesFor, translate, type MessageKey } from "@/lib/i18n/translate";
import { QUEST_STATUSES } from "@/services/creator/donationManagementTypes";
import { decideMyQuest } from "@/services/donations/quests";
import { questExtendedLabel } from "@/services/donations/questTypes";
import { donationStatusLabel, type DonationRecord, type DonationStatus } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

const STATUS_TONE: Record<DonationStatus, string> = {
  COMPLETED: styles.statusCompleted,
  PROCESSING: styles.statusProcessing,
  FAILED: styles.statusFailed,
  REFUNDING: styles.statusProcessing,
  REFUNDED: styles.statusMuted
};

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
const koT: T = (key, vars) => translate(messagesFor(DEFAULT_LOCALE), key, vars);

/**
 * Figma 632:4 후원내역 table (empty 637:214). `t`: the page's translator (getT); Korean when rendered on its own.
 * Status, type, quest and game labels come from the services as written.
 */
export function DonationTable({ items, t = koT }: { items: DonationRecord[]; t?: T }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.donationTable}`}>
        <thead>
          <tr>
            <th scope="col">{t("wallet.dateTime")}</th>
            <th scope="col">{t("wallet.creator")}</th>
            <th scope="col">{t("wallet.donationContent")}</th>
            <th scope="col" className={styles.right}>
              {t("wallet.usedFn")}
            </th>
            <th scope="col" className={styles.center}>
              {t("wallet.donationType")}
            </th>
            <th scope="col" className={styles.center}>
              {t("wallet.status")}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                {t("wallet.noDonations")}
              </td>
            </tr>
          ) : (
            items.map((d) => (
              <tr key={d.id}>
                <td className={styles.datetimeMuted}>{d.donatedAt}</td>
                <td>
                  <Link href={`/creators/${d.creatorId}`} className={styles.creator}>
                    {d.creatorName}
                  </Link>
                </td>
                <td className={styles.message} title={d.message}>
                  {d.message}
                </td>
                <td className={`${styles.right} ${styles.usedFn}`}>{formatNumber(d.fnAmount)} FN</td>
                <td className={styles.center}>
                  <span className={styles.typeChip}>{d.typeLabel}</span>
                </td>
                <td className={`${styles.center} ${STATUS_TONE[d.status]}`}>
                  {/* A failed 플랫폼 후원 whose FN went back reads FN 반환, not 환불완료 (2026-10-09 결정). */}
                  {donationStatusLabel(d)}
                  {/* 퀘스트 후원: the quest's result, or the buttons while the member can decide it. */}
                  {d.quest &&
                    (d.quest.canDecide ? (
                      <span className={styles.questDecide}>
                        <QuestDecide id={d.id} decide={decideMyQuest} />
                      </span>
                    ) : (
                      <span className={styles.questState}>{t("wallet.quest", { status: QUEST_STATUSES.find((s) => s.key === d.quest!.status)?.label ?? "" })}</span>
                    ))}
                  {/* A running quest's deadline in Korea time — later when the creator extended it (2026-10-18 결정). */}
                  {d.quest?.status === "IN_PROGRESS" && (
                    <span className={styles.questState}>
                      {t("wallet.questEnds", { at: kstIsoString(d.quest.endsAt).slice(0, 16).replace("T", " ") })}
                      {d.quest.extendedMin > 0 && ` · ${questExtendedLabel(d.quest.extendedMin)}`}
                    </span>
                  )}
                  {/* 룰렛 · 뽑기: the spin/draw state or its result (prizes are the creator's, no FN). */}
                  {d.gameResult && <span className={styles.questState}>{d.gameResult}</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
