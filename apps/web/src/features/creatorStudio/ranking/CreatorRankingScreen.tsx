import Image from "next/image";
import Link from "next/link";
import { DefaultAvatarIcon, SearchSmallIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
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
export function CreatorRankingScreen({ ranking }: { ranking: CreatorRanking }) {
  const { type, period, query, page, totalPages, rows, me } = ranking;
  const config = RANKING_TYPES.find((t) => t.key === type) ?? RANKING_TYPES[0];
  const base = { type, period, q: query };
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>랭킹</h1>
        <nav className={styles.tabs} aria-label="랭킹 종류">
          {RANKING_TYPES.map((t) => (
            <Link
              key={t.key}
              href={hrefFor({ type: t.key, period })}
              className={`${styles.tab} ${t.key === type ? styles.tabOn : ""}`}
              aria-current={t.key === type ? "page" : undefined}
            >
              {t.tab}
            </Link>
          ))}
        </nav>
      </header>

      <section className={styles.myCard} aria-label={config.myLabel}>
        <div className={styles.myLeft}>
          <div className={styles.myRank}>
            <span className={styles.myLabel}>{config.myLabel}</span>
            <strong className={styles.myRankValue}>
              {me.rank === null ? "-" : formatNumber(me.rank)}위
              {me.change !== null && me.change !== 0 && <Change value={me.change} />}
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
            <dt>랭킹 포인트</dt>
            <dd className={styles.points}>{formatNumber(me.points)}</dd>
          </div>
          <div>
            <dt>{config.countLabel}</dt>
            <dd>{formatNumber(me.count)}회</dd>
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
        <nav className={styles.periods} aria-label="기간">
          {RANKING_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={hrefFor({ type, period: p.key, q: query })}
              className={`${styles.period} ${p.key === period ? styles.periodOn : ""}`}
              aria-current={p.key === period ? "true" : undefined}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form action="/creator/ranking" method="get" role="search" className={styles.search}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="period" value={period} />
          <SearchSmallIcon aria-hidden="true" />
          <label htmlFor="ranking-q" className={styles.srOnly}>
            크리에이터 검색
          </label>
          <input id="ranking-q" name="q" type="search" defaultValue={query} maxLength={RANKING_QUERY_MAX} placeholder="크리에이터 명 입력" />
        </form>
      </div>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>
            {config.tab} ({RANKING_PERIODS.find((p) => p.key === period)?.label})
          </caption>
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">변동</th>
              <th scope="col">크리에이터</th>
              <th scope="col">랭킹 포인트</th>
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
                  {query ? `'${query}' 검색 결과가 없습니다.` : "아직 집계된 랭킹이 없습니다."}
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
                      <Change value={r.change} />
                    </td>
                    <td>
                      <span className={styles.creator}>
                        {r.avatarUrl ? (
                          <Image src={r.avatarUrl} alt="" width={32} height={32} className={styles.avatar} />
                        ) : (
                          <DefaultAvatarIcon width={32} height={32} className={styles.avatar} />
                        )}
                        <span className={styles.name}>{r.name ?? <span aria-label="비공개">*****</span>}</span>
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
          <span className={styles.total}>총 {formatNumber(ranking.total)}명</span>
          <nav className={styles.pagination} aria-label="페이지">
            <PageLink href={hrefFor({ ...base, page: 1 })} disabled={page === 1} label="첫 페이지">
              |&lt;
            </PageLink>
            <PageLink href={hrefFor({ ...base, page: page - 1 })} disabled={page === 1} label="이전 페이지">
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
            <PageLink href={hrefFor({ ...base, page: page + 1 })} disabled={page === totalPages} label="다음 페이지">
              &gt;
            </PageLink>
            <PageLink href={hrefFor({ ...base, page: totalPages })} disabled={page === totalPages} label="마지막 페이지">
              &gt;|
            </PageLink>
          </nav>
        </div>
      </div>
    </div>
  );
}

/** Korean convention: red ▲ up, blue ▼ down, grey - unchanged. */
function Change({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className={styles.same} aria-label="변동 없음">
        -
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={up ? styles.up : styles.down} aria-label={`${Math.abs(value)} ${up ? "상승" : "하락"}`}>
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
