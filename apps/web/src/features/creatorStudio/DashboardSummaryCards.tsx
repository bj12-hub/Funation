import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { DashboardSummary } from "@/services/creator/creatorStudio";
import styles from "./dashboardSummary.module.css";

/** Card shell with the funnation "제목 · 바로가기 ›" header. */
export function SummaryCard({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  const id = `dash-${title}`;
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.head}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        <Link href={href} className={styles.more}>
          {linkLabel} ›
        </Link>
      </div>
      {children}
    </section>
  );
}

/** 받은 후원 — 오늘 · 이번 주 · 이번 달 tiles and the 누적 line (₩, server values). */
export function ReceivedCard({ received }: { received: DashboardSummary["received"] }) {
  const tiles = [
    ["오늘", received.today],
    ["이번 주", received.week],
    ["이번 달", received.month]
  ] as const;
  return (
    <SummaryCard title="받은 후원" href="/creator/donations?tab=list" linkLabel="후원 내역">
      <div className={styles.tiles}>
        {tiles.map(([label, t]) => (
          <div key={label} className={styles.tile}>
            <span className={styles.tileLabel}>{label}</span>
            <strong className={styles.tileValue}>₩{formatNumber(t.amount)}</strong>
            <span className={styles.tileSub}>{formatNumber(t.count)}건</span>
          </div>
        ))}
      </div>
      <p className={styles.total}>
        누적 <strong>₩{formatNumber(received.total.amount)}</strong> · {formatNumber(received.total.count)}건
      </p>
    </SummaryCard>
  );
}

/** 정산 — 정산 가능 · 누적 수익 · 누적 출금 (FN, settlement records). */
export function SettlementCard({ settlement }: { settlement: DashboardSummary["settlement"] }) {
  const tiles = [
    ["정산 가능", settlement.availableFn],
    ["누적 수익", settlement.earnedFn],
    ["누적 출금", settlement.withdrawnFn]
  ] as const;
  return (
    <SummaryCard title="정산" href="/creator/settlement/apply" linkLabel="정산 신청">
      <div className={styles.tiles}>
        {tiles.map(([label, fn]) => (
          <div key={label} className={styles.tile}>
            <span className={styles.tileLabel}>{label}</span>
            <strong className={styles.tileValue}>{formatNumber(fn)} FN</strong>
          </div>
        ))}
      </div>
    </SummaryCard>
  );
}

/** 후원자 순위 — this month's top supporters; links to the ranking widget like funnation. */
export function TopDonorsCard({ donors }: { donors: DashboardSummary["topDonors"] }) {
  return (
    <SummaryCard title="후원자 순위" href="/creator/widgets" linkLabel="랭킹 위젯">
      {donors.length === 0 ? (
        <p className={styles.empty}>아직 후원 받은 내역이 없습니다</p>
      ) : (
        <ol className={styles.ranks}>
          {donors.map((d) => (
            <li key={d.rank}>
              <span className={styles.rank} data-top={d.rank <= 3 || undefined}>
                {d.rank}
              </span>
              <span className={styles.donor}>{d.donor}</span>
              <span className={styles.amount}>₩{formatNumber(d.amount)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.caption}>이번 달 기준</p>
    </SummaryCard>
  );
}
