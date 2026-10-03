import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { RevenueOverview } from "@/services/creator/creatorStudio";
import { SummaryCard, TopDonorsCard } from "../DashboardSummaryCards";
import { RevenueChart } from "../RevenueChart";
import summary from "../dashboardSummary.module.css";
import studio from "../studio.module.css";
import styles from "./revenue.module.css";

/**
 * 수익 현황 — code-first, structure follows the funnation 수익 대시보드: 총 수익 · 미정산 · 오늘 후원 ·
 * 이번 달 tiles with 정산 요청, 일별 후원 추이 (30일), 월별 수익 추이 (6개월), 상위 후원자 and shortcuts.
 * Route `/creator/revenue`. ₩ amounts are server values (gross/net TBD); 미정산 is FN.
 */
export function RevenueScreen({ data }: { data: RevenueOverview }) {
  const empty = data.totalRevenue === 0;
  return (
    <div className={studio.content}>
      <header className={styles.header}>
        <div>
          <h1 className={summary.pageTitle}>수익 현황</h1>
          <p className={styles.subtitle}>전체 수익 현황을 한눈에 확인하세요.</p>
        </div>
        <Link href="/creator/settlement/apply" className={styles.primary}>
          정산 요청
        </Link>
      </header>

      <div className={styles.tiles}>
        <Tile label="총 수익" sub="전체 기간" value={`₩${formatNumber(data.totalRevenue)}`} />
        <Tile label="미정산" sub={data.unsettledFn > 0 ? "정산 가능 금액" : "미정산 금액 없음"} value={`${formatNumber(data.unsettledFn)} FN`} />
        <Tile label="오늘 후원" sub={`${formatNumber(data.today.count)}건`} value={`₩${formatNumber(data.today.amount)}`} />
        <Tile label="이번 달" sub="이번 달 1일부터" value={`₩${formatNumber(data.thisMonth)}`} />
      </div>

      {empty ? (
        <p className={styles.empty}>아직 수익이 없습니다. 후원을 받으면 여기에서 추이를 확인할 수 있어요.</p>
      ) : (
        <div className={summary.grid}>
          <SummaryCard title="일별 후원 추이" href="/creator/donations?tab=list" linkLabel="받은 후원">
            <p className={styles.range}>
              {data.daily[0].label} ~ {data.daily[data.daily.length - 1].label} (최근 30일)
            </p>
            <div className={studio.chartArea}>
              <RevenueChart series={data.daily} fillId="revenue-fill-daily" />
            </div>
          </SummaryCard>
          <SummaryCard title="월별 수익 추이" href="/creator/settlement/manage" linkLabel="정산 관리">
            <p className={styles.range}>최근 6개월</p>
            <div className={studio.chartArea}>
              <RevenueChart series={data.monthly} fillId="revenue-fill-monthly" />
            </div>
          </SummaryCard>
          <TopDonorsCard donors={data.topDonors} />
          <section className={summary.card} aria-labelledby="revenue-links">
            <h2 id="revenue-links" className={summary.title}>
              바로가기
            </h2>
            <ul className={styles.links}>
              <li>
                <Link href="/creator/donations?tab=list">
                  <strong>받은 후원</strong>
                  <span>후원 내역 상세 보기</span>
                </Link>
              </li>
              <li>
                <Link href="/creator/settlement">
                  <strong>정산 현황</strong>
                  <span>정산 인증 · 등록 상태</span>
                </Link>
              </li>
              <li>
                <Link href="/creator/settlement/apply">
                  <strong>정산 요청</strong>
                  <span>수익금 정산 신청</span>
                </Link>
              </li>
            </ul>
            <p className={summary.caption}>수익원별 상세(후원 유형 · 상품)는 준비 중이에요.</p>
          </section>
        </div>
      )}
    </div>
  );
}

function Tile({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <strong className={styles.tileValue}>{value}</strong>
      <span className={styles.tileSub}>{sub}</span>
    </div>
  );
}
