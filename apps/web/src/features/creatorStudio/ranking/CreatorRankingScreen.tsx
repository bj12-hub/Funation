import Image from "next/image";
import Link from "next/link";
import { DefaultAvatarIcon, SearchSmallIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import {
  RANKING_PERIODS,
  RANKING_QUERY_MAX,
  RANKING_TYPES,
  type CreatorRanking,
  type RankingPeriod,
  type RankingType
} from "@/services/creator/creatorRanking";
import styles from "./ranking.module.css";

type Params = { type: RankingType; period: RankingPeriod; q?: string; page?: number };
type T = Awaited<ReturnType<typeof getT>>;

/** RANKING_TYPES · RANKING_PERIODS labels in the viewer's language (2026-11-01). */
const TYPE_KEYS: Record<RankingType, { tab: MessageKey; myLabel: MessageKey; countLabel: MessageKey; rateLabel: MessageKey }> = {
  quest: { tab: "studioRanking.questTab", myLabel: "studioRanking.questMy", countLabel: "studioRanking.questCount", rateLabel: "studioRanking.questRate" }
};
const PERIOD_KEYS: Record<RankingPeriod, MessageKey> = {
  day: "studioRanking.day",
  week: "studioRanking.week",
  month: "studioRanking.month",
  season: "studioRanking.season"
};

function hrefFor({ type, period, q, page }: Params) {
  const sp = new URLSearchParams({ type, period });
  if (q) sp.set("q", q);
  if (page && page > 1) sp.set("page", String(page));
  return `/creator/ranking?${sp}`;
}

const WINDOW = 5;

/**
 * Creator ranking. Figma 405:4 · 405:302 · 405:598 (route `/creator/ranking`).
 * Tabs, period and paging are links and search is a GET form, so every state is a shareable URL.
 */
export async function CreatorRankingScreen({ ranking }: { ranking: CreatorRanking }) {
  const t = await getT();
  const { type, period, query, page, totalPages, rows, me } = ranking;
  const found = RANKING_TYPES.find((r) => r.key === type) ?? RANKING_TYPES[0];
  const keys = TYPE_KEYS[found.key];
  const config = { tab: t(keys.tab), myLabel: t(keys.myLabel), countLabel: t(keys.countLabel), rateLabel: t(keys.rateLabel) };
  const base = { type, period, q: query };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioRanking.title")}</h1>
        <nav className={styles.tabs} aria-label={t("studioRanking.typesAria")}>
          {RANKING_TYPES.map((r) => (
            <Link
              key={r.key}
              href={hrefFor({ type: r.key, period })}
              className={`${styles.tab} ${r.key === type ? styles.tabOn : ""}`}
              aria-current={r.key === type ? "page" : undefined}
            >
              {t(TYPE_KEYS[r.key].tab)}
            </Link>
          ))}
        </nav>
      </header>

      <section className={styles.myCard} aria-label={config.myLabel}>
        <div className={styles.myLeft}>
          <div className={styles.myRank}>
            <span className={styles.myLabel}>{config.myLabel}</span>
            <strong className={styles.myRankValue}>
              {t("studioRanking.rankValue", { rank: me.rank === null ? "-" : formatNumber(me.rank) })}
              {me.change !== null && me.change !== 0 && <Change value={me.change} t={t} />}
            </strong>
          </div>
          <span className={styles.myDivider} aria-hidden="true" />
          {me.avatarUrl ? (
            <Image src={me.avatarUrl} alt="" width={48} height={48} className={styles.myAvatar} />
          ) : (
            <DefaultAvatarIcon width={48} height={48} className={styles.myAvatar} />
          )}
          <div className={styles.myName}>
            <strong>{me.name}</strong>
            <span>@{me.handle}</span>
          </div>
        </div>
        <dl className={styles.myStats}>
          <div>
            <dt>{t("studioRanking.points")}</dt>
            <dd className={styles.points}>{formatNumber(me.points)}</dd>
          </div>
          <div>
            <dt>{config.countLabel}</dt>
            <dd>{t("studioRanking.countValue", { count: formatNumber(me.count) })}</dd>
          </div>
          <div>
            <dt>{config.rateLabel}</dt>
            <dd>
              <span className={styles.ratePill}>{me.rate}%</span>
            </dd>
          </div>
        </dl>
      </section>

      <div className={styles.toolbar}>
        <nav className={styles.periods} aria-label={t("studioRanking.periodAria")}>
          {RANKING_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={hrefFor({ type, period: p.key, q: query })}
              className={`${styles.period} ${p.key === period ? styles.periodOn : ""}`}
              aria-current={p.key === period ? "true" : undefined}
            >
              {t(PERIOD_KEYS[p.key])}
            </Link>
          ))}
        </nav>
        <form action="/creator/ranking" method="get" role="search" className={styles.search}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="period" value={period} />
          <SearchSmallIcon aria-hidden="true" />
          <label htmlFor="ranking-q" className={styles.srOnly}>
            {t("studioRanking.search")}
          </label>
          <input id="ranking-q" name="q" type="search" defaultValue={query} maxLength={RANKING_QUERY_MAX} placeholder={t("studioRanking.searchPlaceholder")} />
        </form>
      </div>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>
            {config.tab} ({t(PERIOD_KEYS[period])})
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("studioRanking.colRank")}</th>
              <th scope="col">{t("studioRanking.colChange")}</th>
              <th scope="col">{t("studioRanking.colCreator")}</th>
              <th scope="col">{t("studioRanking.points")}</th>
              <th scope="col">{config.countLabel}</th>
              <th scope="col" className={styles.right}>
                {config.rateLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  {query ? t("studioRanking.noResults", { query }) : t("studioRanking.empty")}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const top = r.rank <= 3;
                return (
                  <tr key={`${r.rank}-${i}`} className={top ? styles.topRow : undefined}>
                    <td className={styles.rank}>
                      {top && <span aria-hidden="true">🔥</span>}
                      {r.rank}
                    </td>
                    <td>
                      <Change value={r.change} t={t} />
                    </td>
                    <td>
                      <span className={styles.creator}>
                        {r.avatarUrl ? (
                          <Image src={r.avatarUrl} alt="" width={32} height={32} className={styles.avatar} />
                        ) : (
                          <DefaultAvatarIcon width={32} height={32} className={styles.avatar} />
                        )}
                        <span className={styles.name}>{r.name ?? <span aria-label={t("studioRanking.private")}>*****</span>}</span>
                      </span>
                    </td>
                    <td>
                      <span className={styles.pointCell}>
                        {formatNumber(r.points)}
                        <span className={styles.dot} aria-hidden="true" />
                      </span>
                    </td>
                    <td className={styles.count}>{formatNumber(r.count)}</td>
                    <td className={`${styles.right} ${styles.rate}`}>{r.rate}%</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className={styles.footer}>
          <span className={styles.total}>{t("studioRanking.total", { count: formatNumber(ranking.total) })}</span>
          <nav className={styles.pagination} aria-label={t("studioRanking.pagesAria")}>
            <PageLink href={hrefFor({ ...base, page: 1 })} disabled={page === 1} label={t("studioRanking.firstPage")}>
              |&lt;
            </PageLink>
            <PageLink href={hrefFor({ ...base, page: page - 1 })} disabled={page === 1} label={t("studioRanking.prevPage")}>
              &lt;
            </PageLink>
            {pages.map((p) =>
              p === page ? (
                <span key={p} className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link key={p} href={hrefFor({ ...base, page: p })} className={styles.pageButton}>
                  {p}
                </Link>
              )
            )}
            <PageLink href={hrefFor({ ...base, page: page + 1 })} disabled={page === totalPages} label={t("studioRanking.nextPage")}>
              &gt;
            </PageLink>
            <PageLink href={hrefFor({ ...base, page: totalPages })} disabled={page === totalPages} label={t("studioRanking.lastPage")}>
              &gt;|
            </PageLink>
          </nav>
        </div>
      </div>
    </div>
  );
}

/** Korean convention: red ▲ up, blue ▼ down, grey - unchanged. */
function Change({ value, t }: { value: number; t: T }) {
  if (value === 0) {
    return (
      <span className={styles.same} aria-label={t("studioRanking.same")}>
        -
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={up ? styles.up : styles.down} aria-label={t(up ? "studioRanking.up" : "studioRanking.down", { n: Math.abs(value) })}>
      {up ? "▲" : "▼"}
      {formatNumber(Math.abs(value))}
    </span>
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
