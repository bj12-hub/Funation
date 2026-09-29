import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { RANKING_PERIODS, type MyRankingView } from "@/services/supporter/rankingTypes";
import styles from "./supporter.module.css";

/** 내 후원 랭킹 — code-first (no Figma frame). Route `/mypage/ranking` (`?period=`). Server values only. */
export function MyRankingScreen({ view }: { view: MyRankingView }) {
  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href="/mypage">마이페이지</Link> <span aria-hidden="true">›</span> <span aria-current="page">내 랭킹</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>내 후원 랭킹</h1>
        <p className={styles.subtitle}>전체 후원자 중 내 순위와 크리에이터별 순위를 확인하세요.</p>
      </header>

      <nav className={styles.segment} aria-label="기간">
        {RANKING_PERIODS.map((p) => (
          <Link key={p.key} href={p.key === "all" ? "/mypage/ranking" : `/mypage/ranking?period=${p.key}`} aria-current={view.period === p.key ? "page" : undefined} className={styles.segmentLink}>
            {p.label}
          </Link>
        ))}
      </nav>

      <dl className={styles.stats}>
        <div>
          <dt>내 순위</dt>
          <dd>{view.myRank ? `#${view.myRank}` : "-"}</dd>
        </div>
        <div>
          <dt>상위</dt>
          <dd>{view.topPercent ? `${view.topPercent}%` : "-"}</dd>
        </div>
        <div>
          <dt>후원 합계</dt>
          <dd>{formatNumber(view.myTotalFn)} FN</dd>
        </div>
      </dl>
      {!view.visible && <p className={styles.note}>마이페이지에서 랭킹 노출을 모두 껐어요. 이 화면에서는 나에게만 보여요.</p>}

      <section className={styles.card} aria-labelledby="rk-creators">
        <h2 id="rk-creators" className={styles.cardTitle}>
          크리에이터별 내 순위
        </h2>
        {view.creators.length === 0 ? (
          <p className={styles.empty}>이 기간에 후원한 크리에이터가 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {view.creators.map((c) => (
              <li key={c.creatorId} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong className={styles.rowTitle}>{c.creatorName}</strong>
                  <span className={styles.muted}>
                    {formatNumber(c.myTotalFn)} FN 후원
                  </span>
                </div>
                <strong className={styles.rankBadge}>
                  {c.myRank}위 / {c.donors}명
                </strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="rk-board">
        <h2 id="rk-board" className={styles.cardTitle}>
          글로벌 후원자 TOP 20 · 전체 {view.totalDonors}명
        </h2>
        <ol className={styles.board}>
          {view.board.map((r) => (
            <li key={`${r.rank}-${r.name}`} data-me={r.me || undefined}>
              <span className={styles.boardRank}>{r.rank}</span>
              <span className={styles.boardName}>
                {r.name}
                {r.me && <span className={styles.chip}>나</span>}
              </span>
              <span className={styles.boardValue}>{formatNumber(r.totalFn)} FN</span>
            </li>
          ))}
        </ol>
        <p className={styles.note}>다른 후원자 정보는 목업 샘플이에요. 집계 기준(환불·익명 후원 포함 여부, 동점)은 확정 전이에요.</p>
      </section>
    </div>
  );
}
