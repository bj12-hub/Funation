import Link from "next/link";
import { formatNumber, kstIsoString } from "@/lib/format";
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
  type ImportedDonationPage
} from "@/services/creator/donationImportTypes";
import { FlexTvImportCard } from "./FlexTvImportCard";
import { ImportedCsvButton } from "./ImportedCsvButton";
import { ToonationImportCard } from "./ToonationImportCard";
import { UndoImportButton } from "./UndoImportButton";
import styles from "./donations.module.css";
import local from "./importTab.module.css";

/** "2026.10.08 15:04" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");
const WINDOW = 5;

/**
 * 후원관리+ › 내역 이관 — code-first (no Figma frame; funnation "투네이션 후원 내역 이관하기"). 가져오기: 투네이션 CSV,
 * FlexTV 내역, 가져온 기록 (되돌리기). 가져온 내역: the imported records with 출처 · 기간 · 검색 filters. The records stay
 * on these creator-only screens; the 수단별 보드 gets sums only. Not served on the 도우미 host (studio data, not an OBS tool —
 * `/creator/donations?tab=import` goes to the 도우미 home there).
 */
export function ImportTab({ sub, overview, records }: { sub: ImportSubtab; overview: ImportOverview | null; records: ImportedDonationPage | null }) {
  return (
    <div className={styles.stack}>
      <nav className={styles.subTabs} aria-label="내역 이관 메뉴">
        {IMPORT_SUBTABS.map((t) => (
          <Link
            key={t.key}
            href={`/creator/donations?tab=import${t.key === "upload" ? "" : `&sub=${t.key}`}`}
            className={`${styles.tab} ${t.key === sub ? styles.tabOn : ""}`}
            aria-current={t.key === sub ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <aside className={local.notice} aria-label="가져온 내역 안내">
        <p>
          <strong>{IMPORT_PRIVACY_NOTICE}</strong>
        </p>
        <p>{IMPORT_SCOPE_NOTICE}</p>
        <p>{IMPORT_RETENTION_NOTICE}</p>
      </aside>

      {sub === "upload" && overview && (
        <>
          <dl className={styles.listStats} aria-label="가져온 내역 합계">
            {overview.totals.map((t) => (
              <div key={t.source}>
                <dt>{IMPORT_SOURCE_LABEL[t.source]}에서 가져온 내역</dt>
                <dd>
                  {importedTotalsLabel(t.totals)} <span className={styles.listStatsCount}>· {formatNumber(t.count)}건</span>
                </dd>
              </div>
            ))}
          </dl>
          <ToonationImportCard />
          <FlexTvImportCard state={overview.flextv} />
          <BatchList batches={overview.batches} />
        </>
      )}
      {sub === "records" && records && <RecordsView data={records} />}
    </div>
  );
}

function SourceBadge({ source }: { source: ImportBatchView["source"] }) {
  return <span className={`${local.sourceBadge} ${local[`source${source}`]}`}>{IMPORT_SOURCE_LABEL[source]}</span>;
}

function BatchList({ batches }: { batches: ImportBatchView[] }) {
  return (
    <section className={styles.card} aria-labelledby="import-batches">
      <h2 className={styles.cardTitle} id="import-batches">
        가져온 기록
      </h2>
      <p className={styles.desc}>파일을 올리거나 FlexTV 내역을 가져올 때마다 한 줄씩 남아요. 되돌리기를 누르면 그때 가져온 내역만 지워요.</p>
      <div className={local.wrapTable}>
        <table>
          <caption className={styles.srOnly}>가져온 기록</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 140 }}>
                가져온 일시
              </th>
              <th scope="col" style={{ width: 90 }}>
                출처
              </th>
              <th scope="col">파일 · 채널</th>
              <th scope="col" style={{ width: 90 }}>
                가져옴
              </th>
              <th scope="col" style={{ width: 130 }}>
                건너뜀
              </th>
              <th scope="col" style={{ width: 120 }}>
                합계
              </th>
              <th scope="col" style={{ width: 120 }}>
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  아직 가져온 기록이 없어요.
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
                  <td>{formatNumber(b.imported)}건</td>
                  <td>
                    오류 {formatNumber(b.invalid)} · 중복 {formatNumber(b.duplicates)}
                  </td>
                  <td>{importedTotalsLabel(b.totals)}</td>
                  <td>
                    {b.status === "ACTIVE" ? (
                      <UndoImportButton batchId={b.id} source={b.source} when={formatAt(b.createdAt)} count={b.imported} />
                    ) : (
                      <span className={local.undone}>되돌림 · {b.undoneAt ? formatAt(b.undoneAt) : ""}</span>
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

function RecordsView({ data }: { data: ImportedDonationPage }) {
  const { source, from, to, query, page, totalPages, total, items, totals, hasAny } = data;
  const base: Params = { source, from, to, q: query };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const first = total === 0 ? 0 : (page - 1) * IMPORTED_PAGE_SIZE + 1;
  const last = Math.min(total, page * IMPORTED_PAGE_SIZE);

  return (
    <>
      <nav className={styles.chipsRow} aria-label="출처">
        {IMPORTED_SOURCE_FILTERS.map((f) => (
          <Link key={f.key} href={recordsHref({ ...base, source: f.key })} className={`${styles.chip} ${source === f.key ? styles.chipOn : ""}`} aria-current={source === f.key ? "true" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      <form action="/creator/donations" method="get" className={styles.searchForm} role="search">
        <input type="hidden" name="tab" value="import" />
        <input type="hidden" name="sub" value="records" />
        {source !== "all" && <input type="hidden" name="source" value={source} />}
        <span className={styles.dateRange}>
          <input type="date" name="from" aria-label="시작일" defaultValue={from ?? ""} max={to ?? undefined} />
          <span aria-hidden="true">~</span>
          <input type="date" name="to" aria-label="종료일" defaultValue={to ?? ""} />
        </span>
        <input name="q" type="search" aria-label="닉네임 또는 메시지 검색" className={styles.searchInput} placeholder="후원자 닉네임 또는 메시지" defaultValue={query} maxLength={IMPORTED_QUERY_MAX} />
        <button type="submit" className={styles.solidPurple}>
          검색
        </button>
        <ImportedCsvButton filter={{ source, from, to, query }} />
      </form>

      <p className={local.meta} aria-live="polite">
        {from || to ? `${from ?? "처음"} ~ ${to ?? "오늘"} · ` : "전체 기간 · "}
        {formatNumber(total)}건 · 합계 {importedTotalsLabel(totals)}
      </p>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>가져온 후원 내역</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 160 }}>
                후원 일시
              </th>
              <th scope="col" style={{ width: 100 }}>
                출처
              </th>
              <th scope="col" style={{ width: 180 }}>
                후원자 닉네임
              </th>
              <th scope="col" style={{ width: 120 }}>
                금액
              </th>
              <th scope="col">메시지</th>
              <th scope="col" style={{ width: 90 }}>
                유형
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  {!hasAny ? (
                    <>
                      아직 가져온 내역이 없어요. <Link href="/creator/donations?tab=import">가져오기</Link>에서 투네이션 CSV를 올리거나 FlexTV 내역을 가져와 보세요.
                    </>
                  ) : query ? (
                    `'${query}' 검색 결과가 없어요.`
                  ) : (
                    "조건에 맞는 내역이 없어요."
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
            전체 {formatNumber(total)}개 중 {first}-{last} 표시
          </span>
          <nav className={styles.pagination} aria-label="페이지">
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
