import Link from "next/link";
import { PageChevronLeftIcon, PageChevronRightIcon } from "@/components/icons";
import { CREATOR_SORT_LABEL, type CreatorPage, type CreatorSort } from "@/services/creators/creators";
import { CreatorCard } from "./CreatorCard";
import { CreatorSearch } from "./CreatorSearch";
import { creatorsHref, type CreatorsParams } from "./creatorsHref";
import styles from "./creatorsDirectory.module.css";

/**
 * 크리에이터 찾기 — structure follows funnation (docs/architecture/information-architecture.md):
 * title + "지금 N명이 방송 중이에요", search, 인기순 · 라이브 · 최신순, two-column creator cards, paging.
 * Route `/creators` (all roles incl. guests). Figma 690:5 (card visuals adapted).
 */
export function CreatorsScreen({ data, params }: { data: CreatorPage; params: CreatorsParams }) {
  const sort: CreatorSort = params.sort ?? "popular";
  const filtered = Boolean(params.category || params.query || sort === "live");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>크리에이터</h1>
        <p className={styles.subtitle}>{data.liveCount > 0 ? `지금 ${data.liveCount}명이 방송 중이에요` : "지금 방송 중인 크리에이터가 없어요"}</p>
      </header>

      <div className={styles.controls}>
        <CreatorSearch key={params.query ?? ""} params={params} />
        <nav className={styles.sorts} aria-label="정렬">
          {(Object.keys(CREATOR_SORT_LABEL) as CreatorSort[]).map((s) => (
            <Link key={s} href={creatorsHref(params, { sort: s })} className={styles.sort} aria-current={sort === s ? "page" : undefined}>
              {CREATOR_SORT_LABEL[s]}
            </Link>
          ))}
        </nav>
      </div>

      <section aria-label="크리에이터 목록">
        {params.query && (
          <p className={styles.note}>
            ‘{params.query}’ 검색 결과 {data.totalCount}명
          </p>
        )}
        {data.items.length === 0 ? (
          <p className={styles.empty}>{filtered ? "조건에 맞는 크리에이터가 없습니다." : "아직 등록된 크리에이터가 없습니다."}</p>
        ) : (
          <div className={styles.grid}>
            {data.items.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} />
            ))}
          </div>
        )}
        {data.totalPages > 1 && <Pager params={params} page={data.page} totalPages={data.totalPages} />}
      </section>
    </div>
  );
}

/** funnation-style 이전 / 다음 paging with the page position. */
function Pager({ params, page, totalPages }: { params: CreatorsParams; page: number; totalPages: number }) {
  return (
    <nav className={styles.pager} aria-label="페이지">
      {page > 1 ? (
        <Link href={creatorsHref(params, { page: page - 1 })} className={styles.pageButton}>
          <PageChevronLeftIcon /> 이전
        </Link>
      ) : (
        <span className={styles.pageButton} aria-disabled="true">
          <PageChevronLeftIcon /> 이전
        </span>
      )}
      <span className={styles.pagePos}>
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={creatorsHref(params, { page: page + 1 })} className={styles.pageButton}>
          다음 <PageChevronRightIcon />
        </Link>
      ) : (
        <span className={styles.pageButton} aria-disabled="true">
          다음 <PageChevronRightIcon />
        </span>
      )}
    </nav>
  );
}
