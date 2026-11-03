import Link from "next/link";
import { QuestDecide } from "@/features/donations/QuestDecide";
import { formatNumber, kstIsoString } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { decideReceivedQuest } from "@/services/creator/donationManagement";
import { QUEST_STATUSES, type QuestStatus, type StatusFilter } from "@/services/creator/donationManagementTypes";
import type { FlextvQuestPage } from "@/services/creator/flextvBroadcastGames";
import { PageLink } from "./DonationListTab";
import type { T } from "./translator";
import styles from "./donations.module.css";

const STATUS_CLASS = { SUCCESS: styles.badgeSuccess, IN_PROGRESS: styles.badgeProgress, FAILED: styles.badgeFailed, CANCELED: styles.badgeFailed } as const;
/** The services' `QUEST_STATUSES` labels as message keys. */
const STATUS_KEY: Record<QuestStatus, MessageKey> = {
  SUCCESS: "flextvDonations.statusSuccess",
  IN_PROGRESS: "flextvDonations.statusInProgress",
  FAILED: "flextvDonations.statusFailed",
  CANCELED: "flextvDonations.statusCanceled"
};
const STATUS_CHIPS: { key: StatusFilter; label: MessageKey }[] = [{ key: "ALL", label: "flextvDonations.statusAll" }, ...QUEST_STATUSES.map((s) => ({ key: s.key, label: STATUS_KEY[s.key] }))];
const WINDOW = 5;
/** "2026.10.25 15:04" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");
const href = (params: Record<string, string | number>) => `/creator/donations?${new URLSearchParams({ tab: "list", kind: "quest", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })}`;

/** 받은 후원 · 퀘스트 (the FLEXTV page's two lists). `t`: the tab's translator. */
export function FlextvKindNav({ kind, t }: { kind: "all" | "quest"; t: T }) {
  return (
    <nav className={styles.segment} aria-label={t("flextvDonations.kindAria")}>
      <Link href="/creator/donations?tab=list" className={kind === "all" ? styles.segmentOn : undefined} aria-current={kind === "all" ? "page" : undefined}>
        {t("flextvDonations.kindAll")}
      </Link>
      <Link href="/creator/donations?tab=list&kind=quest" className={kind === "quest" ? styles.segmentOn : undefined} aria-current={kind === "quest" ? "page" : undefined}>
        {t("flextvDonations.kindQuest")}
      </Link>
    </nav>
  );
}

/**
 * 받은 후원 › 퀘스트 with FLEXTV (phase 6; the 후원 리스트 539:156 quest layout). The quests sent to the channel, decided
 * here as in the mock (성공 · 실패 with 크리에이터 성공 결정, 취소 always); FLEXTV holds the 렉스 until 성공.
 * The quest note stays Korean (refund wording, TBD), as in `DonationListTab`.
 */
export async function FlextvQuestTab({ data }: { data: FlextvQuestPage }) {
  const t = await getT();
  const { status, page, totalPages, total, items, held } = data;
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const base: Record<string, string> = status === "ALL" ? {} : { status };

  return (
    <div className={styles.stack}>
      <FlextvKindNav kind="quest" t={t} />
      <nav className={styles.chipsRow} aria-label={t("flextvDonations.statusAria")}>
        {STATUS_CHIPS.map((s) => (
          <Link key={s.key} href={href(s.key === "ALL" ? {} : { status: s.key })} className={`${styles.chip} ${status === s.key ? styles.chipOn : ""}`} aria-current={status === s.key ? "true" : undefined}>
            {t(s.label)}
          </Link>
        ))}
      </nav>
      <dl className={styles.listStats} aria-label={t("flextvDonations.heldAria")}>
        <div>
          <dt>{t("flextvDonations.heldTitle")}</dt>
          <dd className={styles.teal}>
            {formatNumber(held.amount)} FN <span className={styles.listStatsCount}>· {t("flextvDonations.heldCount", { count: formatNumber(held.count) })}</span>
          </dd>
        </div>
      </dl>
      <p className={styles.listStatsNote}>퀘스트 후원은 성공하면 받은 후원이 되고, 실패 · 취소되면 시청자에게 전액 돌아가요. 시간이 지나도 결과를 정할 때까지 진행 중으로 남아요.</p>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>{t("flextvDonations.questCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                {t("flextvDonations.colTime")}
              </th>
              <th scope="col" style={{ width: 180 }}>
                {t("flextvDonations.colDonor")}
              </th>
              <th scope="col" style={{ width: 120 }}>
                {t("flextvDonations.colReward")}
              </th>
              <th scope="col">{t("flextvDonations.colQuest")}</th>
              <th scope="col" className={styles.right} style={{ width: 250 }}>
                {t("flextvDonations.colResult")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {t("flextvDonations.questEmpty")}
                </td>
              </tr>
            ) : (
              items.map((q) => (
                <tr key={q.id}>
                  <td className={`${styles.muted} ${styles.nowrap}`}>{formatAt(q.createdAt)}</td>
                  <td className={styles.strong}>
                    <span className={styles.ellipsis}>{q.donorNickname}</span>
                  </td>
                  <td className={styles.amount}>{formatNumber(q.amount)} FN</td>
                  <td>
                    <span className={styles.ellipsis}>{q.title}</span>
                  </td>
                  <td className={styles.right}>
                    {q.actions.length > 0 ? (
                      <>
                        <QuestDecide id={q.id} decide={decideReceivedQuest} actions={q.actions} />
                        <span className={styles.questDeadline}>
                          {t("flextvDonations.deadline", { at: formatAt(q.endsAt) })}
                          {q.extendedMin ? ` · ${t("flextvDonations.extended", { minutes: q.extendedMin })}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className={`${styles.badge} ${STATUS_CLASS[q.status]}`}>{t(STATUS_KEY[q.status])}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.footer}>
          <span className={styles.muted}>{t("flextvDonations.totalCount", { total: formatNumber(total) })}</span>
          <nav className={styles.pagination} aria-label={t("flextvDonations.pages")}>
            <PageLink to={href({ ...base, page: 1 })} disabled={page === 1} label={t("flextvDonations.firstPage")} text="|<" />
            <PageLink to={href({ ...base, page: page - 1 })} disabled={page === 1} label={t("flextvDonations.prevPage")} text="<" />
            {pages.map((p) =>
              p === page ? (
                <span key={p} className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link key={p} href={href({ ...base, page: p })} className={styles.pageButton}>
                  {p}
                </Link>
              )
            )}
            <PageLink to={href({ ...base, page: page + 1 })} disabled={page === totalPages} label={t("flextvDonations.nextPage")} text=">" />
            <PageLink to={href({ ...base, page: totalPages })} disabled={page === totalPages} label={t("flextvDonations.lastPage")} text=">|" />
          </nav>
        </div>
      </div>
    </div>
  );
}
