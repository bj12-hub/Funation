import Image from "next/image";
import Link from "next/link";
import { SearchLargeIcon, VerifiedCheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { FLEXTV_SITE } from "@/lib/flextv/mode";
import { formatCompact } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import { remote } from "@/lib/remoteImage";
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
 * Figma: ssumnation-favorites-page 735:3856 (route `/favorites`, signed-in members)
 */
export async function FavoritesScreen({ data, query, promotion }: Props) {
  const t = await getT();
  const locale = await getLocale();
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
            <button type="button" className={styles.bannerCta} aria-disabled="true" title={t("common.comingSoon")}>
              {promotion.ctaLabel}
            </button>
          )}
        </section>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>{t("myFavorites.title")}</h1>
        <p className={styles.count}>{t("myFavorites.count", { count: data.totalCount })}</p>
      </header>

      {/* Plain GET form: works without JavaScript and with IME input. */}
      <form role="search" action="/favorites" className={styles.search}>
        <SearchLargeIcon />
        <input
          type="search"
          name="q"
          className={styles.searchInput}
          placeholder={t("myFavorites.search")}
          aria-label={t("myFavorites.search")}
          defaultValue={query ?? ""}
          maxLength={50}
        />
      </form>

      {data.items.length === 0 ? (
        <div className={styles.empty}>
          {query ? (
            <>
              <p>{t("myFavorites.noMatch", { query })}</p>
              <Link href="/favorites" className={styles.emptyLink}>
                {t("myFavorites.viewAll")}
              </Link>
            </>
          ) : (
            <>
              <p>{t("myFavorites.none")}</p>
              <Link href="/creators" className={styles.emptyLink}>
                {t("myFavorites.browse")}
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className={styles.list}>
          {data.items.map((c) => (
            <li key={c.creatorId} className={styles.row}>
              <RemoveFavoriteButtons creatorId={c.creatorId} name={c.name} part="heart" />
              <Image src={c.avatarUrl} alt="" width={48} height={48} className={styles.avatar} unoptimized={remote(c.avatarUrl)} />
              <div className={styles.details}>
                <span className={styles.nameRow}>
                  <Link href={`/creators/${c.creatorId}`} className={styles.name}>
                    {c.name}
                  </Link>
                  {c.verified && (
                    <span className={styles.verified} role="img" aria-label={t("myFavorites.verified")}>
                      <VerifiedCheckIcon />
                    </span>
                  )}
                </span>
                <span className={styles.subs}>{t(FLEXTV_SITE ? "myFavorites.favorites" : "myFavorites.subscribers", { count: formatCompact(c.subscriberCount, locale) })}</span>
              </div>
              <span className={`${styles.status} ${c.isLive ? styles.live : ""}`}>{c.isLive ? t("myFavorites.live") : t("myFavorites.offline")}</span>
              <div className={styles.actions}>
                <Button href={`/creators/${c.creatorId}?tab=donation`} className={styles.donate}>
                  {t("myFavorites.donate")}
                </Button>
                <RemoveFavoriteButtons creatorId={c.creatorId} name={c.name} part="button" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {data.totalPages > 1 && (
        <nav className={styles.pagination} aria-label={t("myFavorites.pages")}>
          <PageLink href={pageHref(1, query)} disabled={data.page === 1} label={t("myFavorites.first")}>
            «
          </PageLink>
          <PageLink href={pageHref(data.page - 1, query)} disabled={data.page === 1} label={t("myFavorites.prev")}>
            ‹
          </PageLink>
          <span className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
            {data.page}
          </span>
          <PageLink href={pageHref(data.page + 1, query)} disabled={data.page === data.totalPages} label={t("myFavorites.next")}>
            ›
          </PageLink>
          <PageLink href={pageHref(data.totalPages, query)} disabled={data.page === data.totalPages} label={t("myFavorites.last")}>
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
