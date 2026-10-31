import Link from "next/link";
import { formatNumber, kstIsoString } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translate";
import {
  IMPORTED_PAGE_SIZE,
  IMPORTED_QUERY_MAX,
  IMPORTED_SOURCE_FILTERS,
  IMPORT_PRIVACY_NOTICE,
  IMPORT_RETENTION_NOTICE,
  IMPORT_SCOPE_NOTICE,
  IMPORT_SOURCE_LABEL,
  IMPORT_SUBTABS,
  importedAmountLabel,
  importedTotalsLabel,
  type ImportBatchView,
  type ImportOverview,
  type ImportSubtab,
  type ImportedDonationPage,
  type ImportedSourceFilter
} from "@/services/creator/donationImportTypes";
import { FlexTvImportCard } from "./FlexTvImportCard";
import { ImportedCsvButton } from "./ImportedCsvButton";
import { ToonationImportCard } from "./ToonationImportCard";
import { koT, type T } from "./translator";
import { UndoImportButton } from "./UndoImportButton";
import styles from "./donations.module.css";
import local from "./importTab.module.css";

/** "2026.10.08 15:04" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");
const WINDOW = 5;
const SUBTAB_KEY: Record<ImportSubtab, MessageKey> = { upload: "studioDonationsImport.subUpload", records: "studioDonationsImport.subRecords" };
/** 출처 filter labels: 전체 follows the language; the source names stay as written. */
const sourceFilterLabel = (f: { key: ImportedSourceFilter; label: string }, t: T) => (f.key === "all" ? t("studioDonationsImport.sourceAll") : f.label);

/**
 * 후원관리+ › 내역 이관 — code-first (no Figma frame; funnation "투네이션 후원 내역 이관하기"). 가져오기: 투네이션 CSV,
 * FlexTV 내역, 가져온 기록 (되돌리기). 가져온 내역: the imported records with 출처 · 기간 · 검색 filters. The records stay
 * on these creator-only screens; the 수단별 보드 gets sums only. Not served on the 도우미 host (studio data, not an OBS tool —
 * `/creator/donations?tab=import` goes to the 도우미 home there). `t`: the page's translator (getT); Korean when rendered on
 * its own. The privacy, scope and retention notices and the services' sync and file messages stay Korean (TBD).
 */
export function ImportTab({
  sub,
  overview,
  records,
  t = koT
}: {
  sub: ImportSubtab;
  overview: ImportOverview | null;
  records: ImportedDonationPage | null;
  t?: T;
}) {
  return (
    <div className={styles.stack}>
      <nav className={styles.subTabs} aria-label={t("studioDonationsImport.menu")}>
        {IMPORT_SUBTABS.map((s) => (
          <Link
            key={s.key}
            href={`/creator/donations?tab=import${s.key === "upload" ? "" : `&sub=${s.key}`}`}
            className={`${styles.tab} ${s.key === sub ? styles.tabOn : ""}`}
            aria-current={s.key === sub ? "page" : undefined}
          >
            {t(SUBTAB_KEY[s.key])}
          </Link>
        ))}
      </nav>

      <aside className={local.notice} aria-label={t("studioDonationsImport.noticeAria")}>
        <p>
          <strong>{IMPORT_PRIVACY_NOTICE}</strong>
        </p>
        <p>{IMPORT_SCOPE_NOTICE}</p>
        <p>{IMPORT_RETENTION_NOTICE}</p>
      </aside>

      {sub === "upload" && overview && (
        <>
          <dl className={styles.listStats} aria-label={t("studioDonationsImport.totalsAria")}>
            {overview.totals.map((s) => (
              <div key={s.source}>
                <dt>{t("studioDonationsImport.importedFrom", { source: IMPORT_SOURCE_LABEL[s.source] })}</dt>
                <dd>
                  {importedTotalsLabel(s.totals)} <span className={styles.listStatsCount}>· {t("studioDonationsImport.count", { count: formatNumber(s.count) })}</span>
                </dd>
              </div>
            ))}
          </dl>
          <ToonationImportCard />
          <FlexTvImportCard state={overview.flextv} />
          <BatchList batches={overview.batches} t={t} />
        </>
      )}
      {sub === "records" && records && <RecordsView data={records} t={t} />}
    </div>
  );
}

function SourceBadge({ source }: { source: ImportBatchView["source"] }) {
  return <span className={`${local.sourceBadge} ${local[`source${source}`]}`}>{IMPORT_SOURCE_LABEL[source]}</span>;
}

function BatchList({ batches, t }: { batches: ImportBatchView[]; t: T }) {
  return (
    <section className={styles.card} aria-labelledby="import-batches">
      <h2 className={styles.cardTitle} id="import-batches">
        {t("studioDonationsImport.batchesTitle")}
      </h2>
      <p className={styles.desc}>{t("studioDonationsImport.batchesDesc")}</p>
      <div className={local.wrapTable}>
        <table>
          <caption className={styles.srOnly}>{t("studioDonationsImport.batchesTitle")}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 140 }}>
                {t("studioDonationsImport.colImportedAt")}
              </th>
              <th scope="col" style={{ width: 90 }}>
                {t("studioDonationsImport.colSource")}
              </th>
              <th scope="col">{t("studioDonationsImport.colFile")}</th>
              <th scope="col" style={{ width: 90 }}>
                {t("studioDonationsImport.colImported")}
              </th>
              <th scope="col" style={{ width: 130 }}>
                {t("studioDonationsImport.colSkipped")}
              </th>
              <th scope="col" style={{ width: 120 }}>
                {t("studioDonationsImport.colTotal")}
              </th>
              <th scope="col" style={{ width: 120 }}>
                {t("studioDonationsImport.colManage")}
              </th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  {t("studioDonationsImport.noBatches")}
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td>{formatAt(b.createdAt)}</td>
                  <td>
                    <SourceBadge source={b.source} />
                  </td>
                  <td>
                    <span className={local.clip} title={b.fileName ?? undefined}>
                      {b.fileName ?? (b.channelHandle ? `@${b.channelHandle.replace(/^@/, "")}` : "-")}
                    </span>
                  </td>
                  <td>{t("studioDonationsImport.count", { count: formatNumber(b.imported) })}</td>
                  <td>
                    {t("studioDonationsImport.skippedCounts", { invalid: formatNumber(b.invalid), duplicates: formatNumber(b.duplicates) })}
                  </td>
                  <td>{importedTotalsLabel(b.totals)}</td>
                  <td>
                    {b.status === "ACTIVE" ? (
                      <UndoImportButton batchId={b.id} source={b.source} when={formatAt(b.createdAt)} count={b.imported} />
                    ) : (
                      <span className={local.undone}>{t("studioDonationsImport.undone", { at: b.undoneAt ? formatAt(b.undoneAt) : "" })}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Params = Record<string, string | number | null | undefined>;
function recordsHref(params: Params) {
  const sp = new URLSearchParams({ tab: "import", sub: "records" });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== "all") sp.set(k, String(v));
  return `/creator/donations?${sp}`;
}

function RecordsView({ data, t }: { data: ImportedDonationPage; t: T }) {
  const { source, from, to, query, page, totalPages, total, items, totals, hasAny } = data;
  const base: Params = { source, from, to, q: query };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const first = total === 0 ? 0 : (page - 1) * IMPORTED_PAGE_SIZE + 1;
  const last = Math.min(total, page * IMPORTED_PAGE_SIZE);

  return (
    <>
      <nav className={styles.chipsRow} aria-label={t("studioDonationsImport.sourceAria")}>
        {IMPORTED_SOURCE_FILTERS.map((f) => (
          <Link key={f.key} href={recordsHref({ ...base, source: f.key })} className={`${styles.chip} ${source === f.key ? styles.chipOn : ""}`} aria-current={source === f.key ? "true" : undefined}>
            {sourceFilterLabel(f, t)}
          </Link>
        ))}
      </nav>

      <form action="/creator/donations" method="get" className={styles.searchForm} role="search">
        <input type="hidden" name="tab" value="import" />
        <input type="hidden" name="sub" value="records" />
        {source !== "all" && <input type="hidden" name="source" value={source} />}
        <span className={styles.dateRange}>
          <input type="date" name="from" aria-label={t("studioDonationsImport.from")} defaultValue={from ?? ""} max={to ?? undefined} />
          <span aria-hidden="true">~</span>
          <input type="date" name="to" aria-label={t("studioDonationsImport.to")} defaultValue={to ?? ""} />
        </span>
        <input name="q" type="search" aria-label={t("studioDonationsImport.recordSearch")} className={styles.searchInput} placeholder={t("studioDonationsImport.recordPlaceholder")} defaultValue={query} maxLength={IMPORTED_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          {t("studioDonationsImport.search")}
        </button>
        <ImportedCsvButton filter={{ source, from, to, query }} />
      </form>

      <p className={local.meta} aria-live="polite">
        {from || to ? t("studioDonationsImport.rangeLine", { from: from ?? t("studioDonationsImport.rangeStart"), to: to ?? t("studioDonationsImport.rangeEnd") }) : t("studioDonationsImport.allPeriods")}
        {t("studioDonationsImport.metaTotal", { count: formatNumber(total), total: importedTotalsLabel(totals) })}
      </p>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>{t("studioDonationsImport.recordsCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 160 }}>
                {t("studioDonationsImport.colDonatedAt")}
              </th>
              <th scope="col" style={{ width: 100 }}>
                {t("studioDonationsImport.colSource")}
              </th>
              <th scope="col" style={{ width: 180 }}>
                {t("studioDonationsImport.colDonor")}
              </th>
              <th scope="col" style={{ width: 120 }}>
                {t("studioDonationsImport.colAmount")}
              </th>
              <th scope="col">{t("studioDonationsImport.colMessage")}</th>
              <th scope="col" style={{ width: 90 }}>
                {t("studioDonationsImport.colType")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  {!hasAny ? (
                    <>
                      {t("studioDonationsImport.emptyNone")} <Link href="/creator/donations?tab=import">{t("studioDonationsImport.emptyLink")}</Link>
                      {t("studioDonationsImport.emptyAfter")}
                    </>
                  ) : query ? (
                    t("studioDonationsImport.noResults", { query })
                  ) : (
                    t("studioDonationsImport.noMatch")
                  )}
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id}>
                  <td className={`${styles.muted} ${styles.nowrap}`}>{formatAt(d.at)}</td>
                  <td>
                    <SourceBadge source={d.source} />
                  </td>
                  <td className={styles.strong}>
                    <span className={styles.ellipsis}>{d.donorName}</span>
                  </td>
                  <td className={styles.amount}>{importedAmountLabel(d.amount, d.unit)}</td>
                  <td>
                    <span className={styles.ellipsis} title={d.message}>
                      {d.message}
                    </span>
                  </td>
                  <td className={styles.muted}>
                    <span className={styles.ellipsis}>{d.kind ?? ""}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.footer}>
          <span className={styles.muted}>
            {t("studioDonationsImport.rangeOf", { total: formatNumber(total), first, last })}
          </span>
          <nav className={styles.pagination} aria-label={t("studioDonationsImport.pages")}>
            {pages.map((p) =>
              p === page ? (
                <span key={p} className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link key={p} href={recordsHref({ ...base, page: p })} className={styles.pageButton}>
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
