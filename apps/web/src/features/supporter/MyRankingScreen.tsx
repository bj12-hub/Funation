import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { RANKING_PERIODS, type MyRankingView, type RankingPeriod } from "@/services/supporter/rankingTypes";
import styles from "./supporter.module.css";

const PERIOD_KEY: Record<RankingPeriod, MessageKey> = { all: "myRanking.periodAll", year: "myRanking.periodYear", month: "myRanking.periodMonth" };

/** 내 후원 랭킹 — code-first (no Figma frame). Route `/mypage/ranking` (`?period=`). Server values only. */
export async function MyRankingScreen({ view }: { view: MyRankingView }) {
  const t = await getT();
  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label={t("my.breadcrumb")}>
        <Link href="/mypage">{t("common.myPage")}</Link> <span aria-hidden="true">›</span> <span aria-current="page">{t("myRanking.crumb")}</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("myRanking.title")}</h1>
        <p className={styles.subtitle}>{t("myRanking.subtitle")}</p>
      </header>

      <nav className={styles.segment} aria-label={t("myRanking.period")}>
        {RANKING_PERIODS.map((p) => (
          <Link key={p.key} href={p.key === "all" ? "/mypage/ranking" : `/mypage/ranking?period=${p.key}`} aria-current={view.period === p.key ? "page" : undefined} className={styles.segmentLink}>
            {t(PERIOD_KEY[p.key])}
          </Link>
        ))}
      </nav>

      <dl className={styles.stats}>
        <div>
          <dt>{t("myRanking.myRank")}</dt>
          <dd>{view.myRank ? `#${view.myRank}` : "-"}</dd>
        </div>
        <div>
          <dt>{t("myRanking.top")}</dt>
          <dd>{view.topPercent ? `${view.topPercent}%` : "-"}</dd>
        </div>
        <div>
          <dt>{t("myRanking.total")}</dt>
          <dd>{formatNumber(view.myTotalFn)} FN</dd>
        </div>
      </dl>
      {!view.visible && <p className={styles.note}>{t("myRanking.hidden")}</p>}

      <section className={styles.card} aria-labelledby="rk-creators">
        <h2 id="rk-creators" className={styles.cardTitle}>
          {t("myRanking.byCreator")}
        </h2>
        {view.creators.length === 0 ? (
          <p className={styles.empty}>{t("myRanking.noCreators")}</p>
        ) : (
          <ul className={styles.list}>
            {view.creators.map((c) => (
              <li key={c.creatorId} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong className={styles.rowTitle}>{c.creatorName}</strong>
                  <span className={styles.muted}>{t("myRanking.donated", { fn: formatNumber(c.myTotalFn) })}</span>
                </div>
                <strong className={styles.rankBadge}>
                  {t("myRanking.rankOf", { rank: c.myRank, donors: c.donors })}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rk-board">
        <h2 id="rk-board" className={styles.cardTitle}>
          {t("myRanking.board", { total: view.totalDonors })}
        </h2>
        <ol className={styles.board}>
          {view.board.map((r) => (
            <li key={`${r.rank}-${r.name}`} data-me={r.me || undefined}>
              <span className={styles.boardRank}>{r.rank}</span>
              <span className={styles.boardName}>
                {r.name}
                {r.me && <span className={styles.chip}>{t("myRanking.me")}</span>}
              </span>
              <span className={styles.boardValue}>{formatNumber(r.totalFn)} FN</span>
            </li>
          ))}
        </ol>
        <p className={styles.note}>{t("myRanking.boardNote")}</p>
      </section>
    </div>
  );
}
