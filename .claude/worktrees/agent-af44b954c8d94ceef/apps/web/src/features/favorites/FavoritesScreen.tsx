import Image from "next/image";
import Link from "next/link";
import { SearchLargeIcon, VerifiedCheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { formatCompactKo } from "@/lib/format";
import type { FavoritesPage, PromotionBanner } from "@/services/favorites/favorites";
import { RemoveFavoriteButtons } from "./RemoveFavoriteButtons";
import styles from "./favorites.module.css";

type Props = { data: FavoritesPage; query?: string; promotion: PromotionBanner | null };

const pageHref = (page: number, query?: string) => {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/favorites?${qs}` : "/favorites";
};

/**
 * Favorite creators.
 * Figma: funation-favorites-page 735:3856 (route `/favorites`, signed-in members)
 */
export function FavoritesScreen({ data, query, promotion }: Props) {
  return (
    <div className={styles.content}>
      {promotion && (
        <section className={styles.banner} aria-labelledby="favorites-promo">
          <div className={styles.bannerText}>
            <span className={styles.bannerLabel}>{promotion.label}</span>
            <h2 id="favorites-promo" className={styles.bannerTitle}>
              {promotion.title}
            </h2>
            <p className={styles.bannerDescription}>{promotion.description}</p>
          </div>
          {promotion.href ? (
            <Link href={promotion.href} className={styles.bannerCta}>
              {promotion.ctaLabel}
            </Link>
          ) : (
            <button type="button" className={styles.bannerCta} aria-disabled="true" title="준비 중인 기능입니다">
              {promotion.ctaLabel}
            </button>
          )}
        </section>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>즐겨찾기</h1>
        <p className={styles.count}>총 {data.totalCount}건 즐겨찾기</p>
      </header>

      {/* Plain GET form: works without JavaScript and with IME input. */}
      <form role="search" action="/favorites" className={styles.search}>
        <SearchLargeIcon />
        <input
          type="search"
          name="q"
          className={styles.searchInput}
          placeholder="즐겨찾는 크리에이터 검색"
          aria-label="즐겨찾는 크리에이터 검색"
          defaultValue={query ?? ""}
          maxLength={50}
        />
      </form>

      {data.items.length === 0 ? (
        <div className={styles.empty}>
          {query ? (
            <>
              <p>‘{query}’에 해당하는 즐겨찾기가 없습니다.</p>
              <Link href="/favorites" className={styles.emptyLink}>
                전체 즐겨찾기 보기
              </Link>
            </>
          ) : (
            <>
              <p>아직 즐겨찾기한 크리에이터가 없습니다.</p>
              <Link href="/creators" className={styles.emptyLink}>
                크리에이터 둘러보기
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className={styles.list}>
          {data.items.map((c) => (
            <li key={c.creatorId} className={styles.row}>
              <RemoveFavoriteButtons creatorId={c.creatorId} name={c.name} part="heart" />
              <Image src={c.avatarUrl} alt="" width={48} height={48} className={styles.avatar} />
              <div className={styles.details}>
                <span className={styles.nameRow}>
                  <Link href={`/creators/${c.creatorId}`} className={styles.name}>
                    {c.name}
                  </Link>
                  {c.verified && (
                    <span className={styles.verified} role="img" aria-label="인증된 크리에이터">
                      <VerifiedCheckIcon />
                    </span>
                  )}
                </span>
                <span className={styles.subs}>구독자 {formatCompactKo(c.subscriberCount)}명</span>
              </div>
              <span className={`${styles.status} ${c.isLive ? styles.live : ""}`}>{c.isLive ? "방송 중" : "오프라인"}</span>
              <div className={styles.actions}>
                <Button href={`/creators/${c.creatorId}?tab=donation`} className={styles.donate}>
                  후원하기
                </Button>
                <RemoveFavoriteButtons creatorId={c.creatorId} name={c.name} part="button" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="페이지">
          <PageLink href={pageHref(1, query)} disabled={data.page === 1} label="첫 페이지">
            «
          </PageLink>
          <PageLink href={pageHref(data.page - 1, query)} disabled={data.page === 1} label="이전 페이지">
            ‹
          </PageLink>
          <span className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
            {data.page}
          </span>
          <PageLink href={pageHref(data.page + 1, query)} disabled={data.page === data.totalPages} label="다음 페이지">
            ›
          </PageLink>
          <PageLink href={pageHref(data.totalPages, query)} disabled={data.page === data.totalPages} label="마지막 페이지">
            »
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: string }) {
  if (disabled) {
    return (
      <span className={`${styles.pageButton} ${styles.pageDisabled}`} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={styles.pageButton} aria-label={label}>
      {children}
    </Link>
  );
}
