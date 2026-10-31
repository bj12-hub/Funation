import Link from "next/link";
import { formatNumber, kstIsoString } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translate";
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
import { koT, type T } from "./translator";
import { UnblockButton } from "./UnblockButton";
import styles from "./donations.module.css";

const SUBTAB_KEY: Record<FilterSubtab, MessageKey> = { filter: "studioDonations.subFilter", block: "studioDonations.subBlock" };

/** "2026.10.08 15:04" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");

const blockHref = (q: string, page?: number) => {
  const sp = new URLSearchParams({ tab: "filtering", sub: "block" });
  if (q) sp.set("q", q);
  if (page && page > 1) sp.set("page", String(page));
  return `/creator/donations?${sp}`;
};

/**
 * 후원 필터링 — Figma 539:466 (필터링) · 539:574 (차단 리스트).
 * The design's 당월 필터 date row and 안전 단어 필터 chip have no defined behavior and are left out (TBD).
 * `t`: the studio page's translator; Korean when rendered without one (the 도우미 filtering page).
 */
export function FilteringTab({
  sub,
  settings,
  blocked,
  t = koT
}: {
  sub: FilterSubtab;
  settings: FilterSettings | null;
  blocked: BlockedDonorPage | null;
  t?: T;
}) {
  return (
    <div className={styles.stack}>
      <nav className={styles.subTabs} aria-label={t("studioDonations.filterMenu")}>
        {FILTER_SUBTABS.map((s) => (
          <Link
            key={s.key}
            href={`/creator/donations?tab=filtering&sub=${s.key}`}
            className={`${styles.tab} ${s.key === sub ? styles.tabOn : ""}`}
            aria-current={s.key === sub ? "page" : undefined}
          >
            {t(SUBTAB_KEY[s.key])}
          </Link>
        ))}
      </nav>
      {sub === "filter" && settings && <FilterSettingsPanel initial={settings} />}
      {sub === "block" && blocked && <BlockList data={blocked} t={t} />}
    </div>
  );
}

function BlockList({ data, t }: { data: BlockedDonorPage; t: T }) {
  const { query, page, totalPages, total, items } = data;
  const first = total === 0 ? 0 : (page - 1) * BLOCK_PAGE_SIZE + 1;
  const last = Math.min(total, page * BLOCK_PAGE_SIZE);
  return (
    <>
      <form action="/creator/donations" method="get" className={styles.searchForm} role="search">
        <input type="hidden" name="tab" value="filtering" />
        <input type="hidden" name="sub" value="block" />
        <input name="q" type="search" aria-label={t("studioDonations.blockSearch")} className={styles.searchInput} placeholder={t("studioDonations.blockPlaceholder")} defaultValue={query} maxLength={LIST_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          {t("studioDonations.search")}
        </button>
      </form>
      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>{t("studioDonations.blockCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                {t("studioDonations.colBlockedAt")}
              </th>
              <th scope="col" style={{ width: 220 }}>
                {t("studioDonations.colIdNick")}
              </th>
              <th scope="col" style={{ width: 110 }}>
                {t("studioDonations.colPlatform")}
              </th>
              <th scope="col">{t("studioDonations.colReason")}</th>
              <th scope="col" className={styles.right} style={{ width: 100 }}>
                {t("studioDonations.colManage")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  {query ? t("studioDonations.noResults", { query }) : t("studioDonations.noBlocked")}
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
            {t("studioDonations.rangeOf", { total: formatNumber(total), first, last })}
          </span>
          <nav className={styles.pagination} aria-label={t("studioDonations.pages")}>
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
