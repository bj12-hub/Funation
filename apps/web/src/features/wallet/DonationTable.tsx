import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { QuestDecide } from "@/features/donations/QuestDecide";
import { QUEST_STATUSES } from "@/services/creator/donationManagementTypes";
import { decideMyQuest } from "@/services/donations/quests";
import { donationStatusLabel, type DonationRecord, type DonationStatus } from "@/services/wallet/walletTypes";
import styles from "./wallet.module.css";

const STATUS_TONE: Record<DonationStatus, string> = {
  COMPLETED: styles.statusCompleted,
  PROCESSING: styles.statusProcessing,
  FAILED: styles.statusFailed,
  REFUNDING: styles.statusProcessing,
  REFUNDED: styles.statusMuted
};

/** Figma 632:4 후원내역 table (empty 637:214). */
export function DonationTable({ items }: { items: DonationRecord[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.donationTable}`}>
        <thead>
          <tr>
            <th scope="col">날짜와 시간</th>
            <th scope="col">크리에이터</th>
            <th scope="col">후원 내용</th>
            <th scope="col" className={styles.right}>
              사용 FN 금액
            </th>
            <th scope="col" className={styles.center}>
              후원 유형
            </th>
            <th scope="col" className={styles.center}>
              처리 상태
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className={styles.empty}>
                후원 내역이 존재하지 않습니다.
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
                      <span className={styles.questState}>퀘스트 {QUEST_STATUSES.find((s) => s.key === d.quest!.status)?.label}</span>
                    ))}
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
