import Link from "next/link";
import { formatNumber } from "@/lib/format";
import {
  BLOCK_PAGE_SIZE,
  BLOCK_PLATFORM_LABEL,
  FILTER_SUBTABS,
  LIST_QUERY_MAX,
  type BlockedDonorPage,
  type FilterSettings,
  type FilterSubtab
} from "@/services/creator/donationManagementTypes";
import { FilterSettingsPanel } from "./FilterSettingsPanel";
import { UnblockButton } from "./UnblockButton";
import styles from "./donations.module.css";

function formatAt(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const blockHref = (q: string, page?: number) => {
  const sp = new URLSearchParams({ tab: "filtering", sub: "block" });
  if (q) sp.set("q", q);
  if (page && page > 1) sp.set("page", String(page));
  return `/creator/donations?${sp}`;
};

/**
 * 후원 필터링 — Figma 539:466 (필터링) · 539:574 (차단 리스트).
 * The design's 당월 필터 date row and 안전 단어 필터 chip have no defined behavior and are left out (TBD).
 */
export function FilteringTab({ sub, settings, blocked }: { sub: FilterSubtab; settings: FilterSettings | null; blocked: BlockedDonorPage | null }) {
  return (
    <div className={styles.stack}>
      <nav className={styles.subTabs} aria-label="후원 필터링 메뉴">
        {FILTER_SUBTABS.map((t) => (
          <Link
            key={t.key}
            href={`/creator/donations?tab=filtering&sub=${t.key}`}
            className={`${styles.tab} ${t.key === sub ? styles.tabOn : ""}`}
            aria-current={t.key === sub ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {sub === "filter" && settings && <FilterSettingsPanel initial={settings} />}
      {sub === "block" && blocked && <BlockList data={blocked} />}
    </div>
  );
}

function BlockList({ data }: { data: BlockedDonorPage }) {
  const { query, page, totalPages, total, items } = data;
  const first = total === 0 ? 0 : (page - 1) * BLOCK_PAGE_SIZE + 1;
  const last = Math.min(total, page * BLOCK_PAGE_SIZE);
  return (
    <>
      <form action="/creator/donations" method="get" className={styles.searchForm} role="search">
        <input type="hidden" name="tab" value="filtering" />
        <input type="hidden" name="sub" value="block" />
        <input name="q" type="search" aria-label="차단한 후원자 검색" className={styles.searchInput} placeholder="차단할 닉네임 또는 ID 검색" defaultValue={query} maxLength={LIST_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          검색
        </button>
      </form>
      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>차단 리스트</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                차단 일시
              </th>
              <th scope="col" style={{ width: 220 }}>
                ID / 닉네임
              </th>
              <th scope="col" style={{ width: 110 }}>
                플랫폼
              </th>
              <th scope="col">사유</th>
              <th scope="col" className={styles.right} style={{ width: 100 }}>
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {query ? `'${query}' 검색 결과가 없습니다.` : "차단한 후원자가 없습니다."}
                </td>
              </tr>
            ) : (
              items.map((b) => (
                <tr key={b.id}>
                  <td className={`${styles.muted} ${styles.nowrap}`}>{formatAt(b.blockedAt)}</td>
                  <td className={styles.strong}>
                    <span className={styles.ellipsis}>
                      {b.nickname} ({b.donorId})
                    </span>
                  </td>
                  <td className={styles.muted}>{BLOCK_PLATFORM_LABEL[b.platform]}</td>
                  <td>
                    <span className={styles.ellipsis} title={b.reason}>
                      {b.reason}
                    </span>
                  </td>
                  <td className={styles.right}>
                    <UnblockButton id={b.id} name={`${b.nickname} (${b.donorId})`} />
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) =>
              p === page ? (
                <span key={p} className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link key={p} href={blockHref(query, p)} className={styles.pageButton}>
                  {p}
                </Link>
              )
            )}
          </nav>
        </div>
      </div>
    </>
  );
}
