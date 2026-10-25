import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { LIST_PERIODS } from "@/services/creator/donationManagementTypes";
import { RECEIVED_PAGE_SIZE, RECEIVED_QUERY_MAX, type FlextvReceivedPage } from "@/services/creator/flextvEarnings";
import { PageLink } from "./DonationListTab";
import { FlextvKindNav } from "./FlextvQuestTab";
import styles from "./donations.module.css";

const WINDOW = 5;
/** FLEXTV's rows are KST "yyyy-mm-dd hh:mm:ss": "2026.10.25 15:04". */
const formatAt = (at: string) => at.slice(0, 16).replaceAll("-", ".");

type Params = Record<string, string | number | undefined>;
function href(params: Params) {
  const sp = new URLSearchParams({ tab: "list" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  return `/creator/donations?${sp}`;
}

/**
 * 받은 후원 with FLEXTV (phase 5; code-first, the 후원 리스트 539:156 layout). FLEXTV's list of the 렉스 the streamer
 * received: one row per 후원 or 선물 상품, filtered by period and FLEXTV's exact 닉네임 search. FLEXTV records no message
 * with the list.
 */
export function FlextvReceivedTab({ data, quests = false }: { data: FlextvReceivedPage; quests?: boolean }) {
  const { period, nickname, page, totalPages, total, items, sum } = data;
  const periodParams: Params = period.preset === "range" ? { period: "range", from: period.from, to: period.to } : { period: period.preset };
  const base: Params = { ...periodParams, q: nickname };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const first = total === 0 ? 0 : (page - 1) * RECEIVED_PAGE_SIZE + 1;
  const last = Math.min(total, page * RECEIVED_PAGE_SIZE);

  return (
    <div className={styles.stack}>
      {/* With FLEXTV's Ssumnation endpoints (phase 6) the quests sent to the channel have their own list. */}
      {quests && <FlextvKindNav kind="all" />}
      <div className={styles.filterRow}>
        <nav className={styles.chipsRow} aria-label="기간">
          {LIST_PERIODS.map((p) => (
            <Link key={p.key} href={href({ period: p.key, q: nickname })} className={`${styles.chip} ${period.preset === p.key ? styles.chipOn : ""}`} aria-current={period.preset === p.key ? "true" : undefined}>
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      <form action="/creator/donations" method="get" className={styles.searchForm} role="search">
        <input type="hidden" name="tab" value="list" />
        <input type="hidden" name="period" value="range" />
        <span className={styles.dateRange}>
          <input type="date" name="from" aria-label="시작일" defaultValue={period.from} max={period.to} />
          <span aria-hidden="true">~</span>
          <input type="date" name="to" aria-label="종료일" defaultValue={period.to} />
        </span>
        <input name="q" type="search" aria-label="후원자 닉네임 검색" className={styles.searchInput} placeholder="후원자 닉네임 (정확히 일치)" defaultValue={nickname} maxLength={RECEIVED_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          검색
        </button>
      </form>

      {sum && (
        <dl className={styles.listStats} aria-label="조회한 후원 요약">
          <div>
            <dt>받은 렉스</dt>
            <dd className={styles.teal}>{formatNumber(sum.amount)} FN</dd>
          </div>
          <div>
            <dt>후원</dt>
            <dd>{formatNumber(sum.count)}건</dd>
          </div>
        </dl>
      )}
      {sum?.partial && <p className={styles.listStatsNote}>이 기간은 후원이 많아 최근 후원부터 일부만 더했어요. 기간을 좁히면 정확하게 볼 수 있어요.</p>}
      <p className={styles.listStatsNote}>FLEXTV와 썸네이션에서 받은 렉스가 모두 보여요. 합계는 FLEXTV처럼 취소된 후원을 빼고 더해요.</p>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>받은 후원 목록</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                시간
              </th>
              <th scope="col" style={{ width: 200 }}>
                후원자 닉네임
              </th>
              <th scope="col" style={{ width: 130 }}>
                렉스
              </th>
              <th scope="col">선물</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  {nickname ? `'${nickname}' 검색 결과가 없습니다.` : "선택한 기간에 받은 후원이 없습니다."}
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id}>
                  <td className={`${styles.muted} ${styles.nowrap}`}>{formatAt(d.at)}</td>
                  <td className={styles.strong}>
                    <span className={styles.ellipsis}>{d.donorNickname}</span>
                  </td>
                  <td className={styles.amount}>{formatNumber(d.rex)} FN</td>
                  <td>
                    <span className={styles.ellipsis}>{d.productName ?? "-"}</span>
                    {!d.counted && <span className={styles.muted}> · 취소</span>}
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
