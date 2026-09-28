import Link from "next/link";
import { PageChevronLeftIcon, PageChevronRightIcon } from "@/components/icons";
import { CREATOR_CATEGORY_LABEL, type CreatorCategory, type CreatorPage } from "@/services/creators/creators";
import { CreatorCard } from "./CreatorCard";
import { CreatorSortSelect } from "./CreatorControls";
import { CreatorSearch } from "./CreatorSearch";
import { creatorsHref, type CreatorsParams } from "./creatorsHref";
import styles from "./creators.module.css";

/**
 * Creator directory.
 * Figma: funation-all-creators-page 690:5 (route `/creators`, all roles incl. guests)
 */
export function CreatorsScreen({ data, params }: { data: CreatorPage; params: CreatorsParams }) {
  const categories = Object.keys(CREATOR_CATEGORY_LABEL) as CreatorCategory[];
  const filtered = Boolean(params.category || params.query);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroRow}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>✨ Funation 크리에이터 목록</h1>
            <p className={styles.subtitle}>취향 저격 예능부터 숨겨진 꿀잼 라이브까지, 지금 가장 핫한 크리에이터들을 한눈에 만나보세요.</p>
          </div>
          <CreatorSearch key={params.query ?? ""} params={params} />
        </div>

        <div className={styles.filters}>
          <nav className={styles.tabs} aria-label="카테고리">
            <Link
              href={creatorsHref(params, { category: undefined })}
              className={`${styles.tab} ${!params.category ? styles.tabActive : ""}`}
              aria-current={!params.category ? "page" : undefined}
            >
              전체
            </Link>
            {categories.map((c) => (
              <Link
                key={c}
                href={creatorsHref(params, { category: c })}
                className={`${styles.tab} ${params.category === c ? styles.tabActive : ""}`}
                aria-current={params.category === c ? "page" : undefined}
              >
                {CREATOR_CATEGORY_LABEL[c]}
              </Link>
            ))}
          </nav>
          <CreatorSortSelect params={params} />
        </div>
      </header>

      <section className={styles.results} aria-label="크리에이터">
        {params.query && (
          <p className={styles.resultNote}>
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

        {data.totalPages > 1 && <Pagination params={params} page={data.page} totalPages={data.totalPages} />}
      </section>
    </div>
  );
}

/** Figma 690:5 pagination — shows up to 5 page numbers around the current page. */
function Pagination({ params, page, totalPages }: { params: CreatorsParams; page: number; totalPages: number }) {
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => first + i);

  return (
    <nav className={styles.pagination} aria-label="페이지">
      <PageLink params={params} page={page - 1} disabled={page <= 1} label="이전 페이지">
        <PageChevronLeftIcon />
      </PageLink>
      {pages.map((p) => (
        <Link
          key={p}
          href={creatorsHref(params, { page: p })}
          className={`${styles.pageButton} ${p === page ? styles.pageActive : ""}`}
          aria-current={p === page ? "page" : undefined}
        >
          {p}
        </Link>
      ))}
      <PageLink params={params} page={page + 1} disabled={page >= totalPages} label="다음 페이지">
        <PageChevronRightIcon />
      </PageLink>
    </nav>
  );
}

function PageLink({ params, page, disabled, label, children }: { params: CreatorsParams; page: number; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span className={`${styles.pageArrow} ${styles.pageDisabled}`} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={creatorsHref(params, { page })} className={styles.pageArrow} aria-label={label}>
      {children}
    </Link>
  );
}
