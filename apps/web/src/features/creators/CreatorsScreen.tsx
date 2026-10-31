import Link from "next/link";
import { PageChevronLeftIcon, PageChevronRightIcon } from "@/components/icons";
import { formatCompact } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { CREATOR_SORT_LABEL, type CreatorPage, type CreatorSort } from "@/services/creators/creators";

const SORT_KEY: Record<CreatorSort, MessageKey> = { popular: "creators.sortPopular", live: "creators.sortLive", recent: "creators.sortRecent" };
import { CreatorCard } from "./CreatorCard";
import { CreatorSearch } from "./CreatorSearch";
import { creatorsHref, type CreatorsParams } from "./creatorsHref";
import styles from "./creatorsDirectory.module.css";

/**
 * 크리에이터 찾기 — structure follows funnation (docs/architecture/information-architecture.md):
 * title + "지금 N명이 방송 중이에요", search, 인기순 · 라이브 · 최신순, two-column creator cards, paging.
 * Route `/creators` (all roles incl. guests). Figma 690:5 (card visuals adapted).
 */
export async function CreatorsScreen({ data, params }: { data: CreatorPage; params: CreatorsParams }) {
  const t = await getT();
  const locale = await getLocale();
  const sort: CreatorSort = params.sort ?? "popular";
  const filtered = Boolean(params.category || params.query || sort === "live");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("creators.title")}</h1>
        <p className={styles.subtitle}>{data.liveCount > 0 ? t("creators.liveNow", { count: data.liveCount }) : t("creators.noneLive")}</p>
      </header>

      <div className={styles.controls}>
        <CreatorSearch key={params.query ?? ""} params={params} label={t("creators.search")} />
        <nav className={styles.sorts} aria-label={t("creators.sort")}>
          {(Object.keys(CREATOR_SORT_LABEL) as CreatorSort[]).map((s) => (
            <Link key={s} href={creatorsHref(params, { sort: s })} className={styles.sort} aria-current={sort === s ? "page" : undefined}>
              {t(SORT_KEY[s])}
            </Link>
          ))}
        </nav>
      </div>

      <section aria-label={t("creators.list")}>
        {params.query && (
          <p className={styles.note}>
            {t("creators.results", { query: params.query, count: data.totalCount })}
          </p>
        )}
        {data.items.length === 0 ? (
          <p className={styles.empty}>{filtered ? t("creators.noMatch") : t("creators.none")}</p>
        ) : (
          <div className={styles.grid}>
            {data.items.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} labels={{ subscribers: (count) => t("creators.subscribers", { count: formatCompact(count, locale) }), watching: (count) => t("creators.watching", { count }) }} />
            ))}
          </div>
        )}
        {data.totalPages > 1 && <Pager params={params} page={data.page} totalPages={data.totalPages} labels={{ pages: t("creators.pages"), prev: t("creators.prev"), next: t("creators.next") }} />}
      </section>
    </div>
  );
}

/** funnation-style 이전 / 다음 paging with the page position. */
function Pager({ params, page, totalPages, labels }: { params: CreatorsParams; page: number; totalPages: number; labels: { pages: string; prev: string; next: string } }) {
  return (
    <nav className={styles.pager} aria-label={labels.pages}>
      {page > 1 ? (
        <Link href={creatorsHref(params, { page: page - 1 })} className={styles.pageButton}>
          <PageChevronLeftIcon /> {labels.prev}
        </Link>
      ) : (
        <span className={styles.pageButton} aria-disabled="true">
          <PageChevronLeftIcon /> {labels.prev}
        </span>
      )}
      <span className={styles.pagePos}>
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={creatorsHref(params, { page: page + 1 })} className={styles.pageButton}>
          {labels.next} <PageChevronRightIcon />
        </Link>
      ) : (
        <span className={styles.pageButton} aria-disabled="true">
          {labels.next} <PageChevronRightIcon />
        </span>
      )}
    </nav>
  );
}
