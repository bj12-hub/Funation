import Link from "next/link";
import { formatNumber, kstIsoString } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translate";
import {
  LIST_KINDS,
  LIST_PAGE_SIZE,
  LIST_PERIODS,
  LIST_QUERY_MAX,
  QUEST_STATUSES,
  type ListKind,
  type ListPeriodPreset,
  type QuestStatus,
  type ReceivedDonationPage
} from "@/services/creator/donationManagementTypes";
import { QuestDecide } from "@/features/donations/QuestDecide";
import { decideReceivedQuest } from "@/services/creator/donationManagement";
import { questExtendedLabel } from "@/services/donations/questTypes";
import { CsvExportButton } from "./CsvExportButton";
import { koT, type T } from "./translator";
import { YearSelect } from "./YearSelect";
import styles from "./donations.module.css";

const STATUS_CLASS = { SUCCESS: styles.badgeSuccess, IN_PROGRESS: styles.badgeProgress, FAILED: styles.badgeFailed, CANCELED: styles.badgeFailed } as const;
const WINDOW = 5;

/** The services' list labels (`LIST_KINDS`, `LIST_PERIODS`, `QUEST_STATUSES`) as message keys. */
const KIND_KEY: Record<ListKind, { label: MessageKey; column: MessageKey }> = {
  quest: { label: "studioDonationsList.kindQuest", column: "studioDonationsList.colQuest" },
  game: { label: "studioDonationsList.kindGame", column: "studioDonationsList.colGame" },
  crew: { label: "studioDonationsList.kindCrew", column: "studioDonationsList.colCrew" }
};
const PERIOD_KEY: Record<Exclude<ListPeriodPreset, "year" | "range">, MessageKey> = {
  today: "studioDonationsList.periodToday",
  "1w": "studioDonationsList.period1w",
  "1m": "studioDonationsList.period1m",
  "3m": "studioDonationsList.period3m",
  "6m": "studioDonationsList.period6m",
  "1y": "studioDonationsList.period1y"
};
const QUEST_STATUS_KEY: Record<QuestStatus, MessageKey> = {
  SUCCESS: "studioDonationsList.statusSuccess",
  IN_PROGRESS: "studioDonationsList.statusInProgress",
  FAILED: "studioDonationsList.statusFailed",
  CANCELED: "studioDonationsList.statusCanceled"
};

/** "2026.10.08 15:04" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");

type Params = Record<string, string | number | undefined>;
function href(params: Params) {
  const sp = new URLSearchParams({ tab: "list" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== "ALL") sp.set(k, String(v));
  return `/creator/donations?${sp}`;
}

/**
 * 후원 리스트 — Figma 539:156. Filters are links and a GET form, so every state is a URL.
 * Only 퀘스트 후원 is designed; 게임 후원 (룰렛 · 뽑기) and 크루 후원 (멤버를 지정한 후원) are code-first with
 * the same table — the last column shows the game or the member, and the 상태 filter is quest-only.
 * `t`: the page's translator (getT); Korean when rendered on its own. The quest-stats note stays Korean (refund wording, TBD).
 */
export function DonationListTab({ data, t = koT }: { data: ReceivedDonationPage; t?: T }) {
  const { kind, period, status, query, page, totalPages, total, items, stats, years } = data;
  const periodParams: Params =
    period.preset === "range" ? { period: "range", from: period.from, to: period.to } : period.preset === "year" ? { period: "year", year: period.year } : { period: period.preset };
  const base: Params = { kind, ...periodParams, status, q: query };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const first = total === 0 ? 0 : (page - 1) * LIST_PAGE_SIZE + 1;
  const last = Math.min(total, page * LIST_PAGE_SIZE);
  const kindInfo = KIND_KEY[kind];

  return (
    <div className={styles.stack}>
      <nav className={styles.segment} aria-label={t("studioDonationsList.kindAria")}>
        {LIST_KINDS.map((k) => (
          <Link key={k.key} href={href({ ...base, kind: k.key, page: undefined })} className={k.key === kind ? styles.segmentOn : undefined} aria-current={k.key === kind ? "page" : undefined}>
            {t(KIND_KEY[k.key].label)}
          </Link>
        ))}
      </nav>

      <div className={styles.filterRow}>
        <nav className={styles.chipsRow} aria-label={t("studioDonationsList.periodAria")}>
          {LIST_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={href({ kind, period: p.key, status, q: query })}
              className={`${styles.chip} ${period.preset === p.key ? styles.chipOn : ""}`}
              aria-current={period.preset === p.key ? "true" : undefined}
            >
              {t(PERIOD_KEY[p.key])}
            </Link>
          ))}
          <YearSelect years={years} value={period.preset === "year" ? period.year : undefined} baseParams={{ tab: "list", kind, status, q: query }} />
        </nav>
      </div>

      <form action="/creator/donations" method="get" className={styles.searchForm} role="search">
        <input type="hidden" name="tab" value="list" />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="period" value="range" />
        <span className={styles.dateRange}>
          <input type="date" name="from" aria-label={t("studioDonationsList.from")} defaultValue={period.from} max={period.to} />
          <span aria-hidden="true">~</span>
          <input type="date" name="to" aria-label={t("studioDonationsList.to")} defaultValue={period.to} />
        </span>
        {kind === "quest" && (
          <select name="status" aria-label={t("studioDonationsList.statusFilter")} defaultValue={status} className={styles.select}>
            <option value="ALL">{t("studioDonationsList.allStatuses")}</option>
            {QUEST_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {t(QUEST_STATUS_KEY[s.key])}
              </option>
            ))}
          </select>
        )}
        <input name="q" type="search" aria-label={t("studioDonationsList.donorSearch")} className={styles.searchInput} placeholder={t("studioDonationsList.donorPlaceholder")} defaultValue={query} maxLength={LIST_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          {t("studioDonationsList.search")}
        </button>
        <CsvExportButton filter={{ kind, period, status, query }} />
      </form>

      {/* Code-first (2026-10-06, funnation 받은 후원 요약): over every row the filters match. */}
      <dl className={styles.listStats} aria-label={t("studioDonationsList.statsAria")}>
        <div>
          <dt>{t("studioDonationsList.statTotal")}</dt>
          <dd className={styles.teal}>{formatNumber(stats.totalFn)} FN</dd>
        </div>
        <div>
          <dt>{t("studioDonationsList.statToday")}</dt>
          <dd>{formatNumber(stats.todayFn)} FN</dd>
        </div>
        <div>
          <dt>{t("studioDonationsList.statWeek")}</dt>
          <dd>{formatNumber(stats.weekFn)} FN</dd>
        </div>
        <div>
          <dt>{t("studioDonationsList.statAverage")}</dt>
          <dd>
            {formatNumber(stats.averageFn)} FN <span className={styles.listStatsCount}>· {t("studioDonationsList.count", { count: formatNumber(stats.count) })}</span>
          </dd>
        </div>
        {stats.heldCount > 0 && (
          <div>
            <dt>{t("studioDonationsList.statHeld")}</dt>
            <dd>
              {formatNumber(stats.heldFn)} FN <span className={styles.listStatsCount}>· {t("studioDonationsList.count", { count: formatNumber(stats.heldCount) })}</span>
            </dd>
          </div>
        )}
      </dl>
      {(kind === "quest" || stats.heldCount > 0) && (
        <p className={styles.listStatsNote}>퀘스트 후원은 성공한 날 기준으로 수령액과 기간에 들어가요. 진행 중인 퀘스트는 따로 보여 주고, 실패 · 취소된 퀘스트는 전액 환불돼 빠져요.</p>
      )}
      {/* Code-first (2026-10-16): imported records stay out of these FN totals; they have their own view. */}
      <p className={styles.listStatsNote}>
        {t("studioDonationsList.importNote")} <Link href="/creator/donations?tab=import&sub=records">{t("studioDonationsList.importNoteLink")}</Link>
        {t("studioDonationsList.importNoteAfter")}
      </p>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>{t("studioDonationsList.caption", { kind: t(kindInfo.label) })}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                {t("studioDonationsList.colTime")}
              </th>
              <th scope="col" style={{ width: 200 }}>
                {t("studioDonationsList.colDonor")}
              </th>
              <th scope="col" style={{ width: 130 }}>
                {t("studioDonationsList.colAmount")}
              </th>
              <th scope="col">{t("studioDonationsList.colContent")}</th>
              <th scope="col" className={styles.right} style={{ width: kind === "quest" ? 250 : 120 }}>
                {t(kindInfo.column)}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {query ? t("studioDonationsList.noResults", { query }) : kind === "crew" ? t("studioDonationsList.emptyCrew") : t("studioDonationsList.empty")}
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id}>
                  <td className={`${styles.muted} ${styles.nowrap}`}>{formatAt(d.at)}</td>
                  <td className={styles.strong}>
                    <span className={styles.ellipsis}>
                      {d.donorNickname}
                      {d.donorId && ` (${d.donorId})`}
                    </span>
                  </td>
                  <td className={styles.amount}>{formatNumber(d.amount)} FN</td>
                  <td>
                    <span className={styles.ellipsis}>{d.message}</span>
                  </td>
                  <td className={styles.right}>
                    {d.questActions?.length ? (
                      <>
                        <QuestDecide id={d.id} decide={decideReceivedQuest} actions={d.questActions} />
                        {/* A running quest's deadline (the extended one after a 리모컨 시간 연장, 2026-10-18 결정). */}
                        {d.questEndsAt && (
                          <span className={styles.questDeadline}>
                            {t("studioDonationsList.deadline", { at: formatAt(d.questEndsAt) })}
                            {d.questExtendedMin ? ` · ${questExtendedLabel(d.questExtendedMin)}` : ""}
                          </span>
                        )}
                      </>
                    ) : d.status ? (
                      <>
                        <span className={`${styles.badge} ${STATUS_CLASS[d.status]}`}>{t(QUEST_STATUS_KEY[d.status])}</span>
                        {d.status === "SUCCESS" && d.receivedAt !== d.at && <span className={`${styles.muted} ${styles.nowrap}`}> {formatAt(d.receivedAt)}</span>}
                      </>
                    ) : (
                      <span className={styles.strong}>{d.detail}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.footer}>
          <span className={styles.muted}>
            {t("studioDonationsList.rangeOf", { total: formatNumber(total), first, last })}
          </span>
          <nav className={styles.pagination} aria-label={t("studioDonationsList.pages")}>
            <PageLink to={href({ ...base, page: 1 })} disabled={page === 1} label={t("studioDonationsList.firstPage")} text="|<" />
            <PageLink to={href({ ...base, page: page - 1 })} disabled={page === 1} label={t("studioDonationsList.prevPage")} text="<" />
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
            <PageLink to={href({ ...base, page: page + 1 })} disabled={page === totalPages} label={t("studioDonationsList.nextPage")} text=">" />
            <PageLink to={href({ ...base, page: totalPages })} disabled={page === totalPages} label={t("studioDonationsList.lastPage")} text=">|" />
          </nav>
        </div>
      </div>
    </div>
  );
}

function PageLink({ to, disabled, label, text }: { to: string; disabled: boolean; label: string; text: string }) {
  return disabled ? (
    <span className={`${styles.pageButton} ${styles.pageDisabled}`} aria-disabled="true" aria-label={label}>
      {text}
    </span>
  ) : (
    <Link href={to} className={styles.pageButton} aria-label={label}>
      {text}
    </Link>
  );
}
