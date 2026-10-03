import Link from "next/link";
import { formatNumber } from "@/lib/format";
import {
  LIST_KINDS,
  LIST_PAGE_SIZE,
  LIST_PERIODS,
  LIST_QUERY_MAX,
  QUEST_STATUSES,
  type ReceivedDonationPage
} from "@/services/creator/donationManagementTypes";
import { QuestDecide } from "@/features/donations/QuestDecide";
import { decideReceivedQuest } from "@/services/creator/donationManagement";
import { CsvExportButton } from "./CsvExportButton";
import { YearSelect } from "./YearSelect";
import styles from "./donations.module.css";

const STATUS_CLASS = { SUCCESS: styles.badgeSuccess, IN_PROGRESS: styles.badgeProgress, FAILED: styles.badgeFailed } as const;
const WINDOW = 5;

function formatAt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Params = Record<string, string | number | undefined>;
function href(params: Params) {
  const sp = new URLSearchParams({ tab: "list" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== "ALL") sp.set(k, String(v));
  return `/creator/donations?${sp}`;
}

/**
 * 후원 리스트 — Figma 539:156. Filters are links and a GET form, so every state is a URL.
 * Only 퀘스트 후원 is designed; 게임 후원 (룰렛 · 퀴즈) and 크루 후원 (멤버를 지정한 후원) are code-first with
 * the same table — the last column shows the game or the member, and the 상태 filter is quest-only.
 */
export function DonationListTab({ data }: { data: ReceivedDonationPage }) {
  const { kind, period, status, query, page, totalPages, total, items, years } = data;
  const periodParams: Params =
    period.preset === "range" ? { period: "range", from: period.from, to: period.to } : period.preset === "year" ? { period: "year", year: period.year } : { period: period.preset };
  const base: Params = { kind, ...periodParams, status, q: query };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const first = total === 0 ? 0 : (page - 1) * LIST_PAGE_SIZE + 1;
  const last = Math.min(total, page * LIST_PAGE_SIZE);
  const kindInfo = LIST_KINDS.find((k) => k.key === kind)!;

  return (
    <div className={styles.stack}>
      <nav className={styles.segment} aria-label="후원 종류">
        {LIST_KINDS.map((k) => (
          <Link key={k.key} href={href({ ...base, kind: k.key, page: undefined })} className={k.key === kind ? styles.segmentOn : undefined} aria-current={k.key === kind ? "page" : undefined}>
            {k.label}
          </Link>
        ))}
      </nav>

      <div className={styles.filterRow}>
        <nav className={styles.chipsRow} aria-label="기간">
          {LIST_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={href({ kind, period: p.key, status, q: query })}
              className={`${styles.chip} ${period.preset === p.key ? styles.chipOn : ""}`}
              aria-current={period.preset === p.key ? "true" : undefined}
            >
              {p.label}
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
          <input type="date" name="from" aria-label="시작일" defaultValue={period.from} max={period.to} />
          <span aria-hidden="true">~</span>
          <input type="date" name="to" aria-label="종료일" defaultValue={period.to} />
        </span>
        {kind === "quest" && (
          <select name="status" aria-label="상태 필터" defaultValue={status} className={styles.select}>
            <option value="ALL">전체 필터</option>
            {QUEST_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <input name="q" type="search" aria-label="후원자 검색" className={styles.searchInput} placeholder="후원자 닉네임 or 아이디" defaultValue={query} maxLength={LIST_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          검색
        </button>
        <CsvExportButton filter={{ kind, period, status, query }} />
      </form>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>{kindInfo.label} 목록</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                시간
              </th>
              <th scope="col" style={{ width: 200 }}>
                후원자 닉네임(ID)
              </th>
              <th scope="col" style={{ width: 130 }}>
                후원금액
              </th>
              <th scope="col">내용</th>
              <th scope="col" className={styles.right} style={{ width: kind === "quest" ? 170 : 120 }}>
                {kindInfo.column}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {query ? `'${query}' 검색 결과가 없습니다.` : kind === "crew" ? "선택한 기간에 멤버를 지정해 받은 후원이 없습니다." : "선택한 기간에 받은 후원이 없습니다."}
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
                    {d.canDecide ? (
                      <QuestDecide id={d.id} decide={decideReceivedQuest} />
                    ) : d.status ? (
                      <span className={`${styles.badge} ${STATUS_CLASS[d.status]}`}>{QUEST_STATUSES.find((s) => s.key === d.status)?.label}</span>
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
            전체 {formatNumber(total)}개 중 {first}-{last} 표시
          </span>
          <nav className={styles.pagination} aria-label="페이지">
            <PageLink to={href({ ...base, page: 1 })} disabled={page === 1} label="첫 페이지" text="|<" />
            <PageLink to={href({ ...base, page: page - 1 })} disabled={page === 1} label="이전 페이지" text="<" />
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
            <PageLink to={href({ ...base, page: page + 1 })} disabled={page === totalPages} label="다음 페이지" text=">" />
            <PageLink to={href({ ...base, page: totalPages })} disabled={page === totalPages} label="마지막 페이지" text=">|" />
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
