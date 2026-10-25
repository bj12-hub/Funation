import Link from "next/link";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import type { AmountUnit, DashboardSummary } from "@/services/creator/creatorStudio";
import { formatAmount } from "./amount";
import styles from "./dashboardSummary.module.css";

/** Card shell with the funnation "제목 · 바로가기 ›" header. */
export function SummaryCard({ title, href, linkLabel, children }: { title: string; href: string; linkLabel: string; children: React.ReactNode }) {
  // An id cannot contain spaces (aria-labelledby splits on them).
  const id = `dash-${title.replace(/\s+/g, "-")}`;
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

/** 받은 후원 — 오늘 · 이번 주 · 이번 달 tiles and the 누적 line (₩, or FN with FLEXTV; server values). */
export function ReceivedCard({ received, unit = "KRW" }: { received: DashboardSummary["received"]; unit?: AmountUnit }) {
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
            <strong className={styles.tileValue}>{formatAmount(t.amount, unit)}</strong>
            <span className={styles.tileSub}>{formatNumber(t.count)}건</span>
          </div>
        ))}
      </div>
      <p className={styles.total}>
        누적 <strong>{formatAmount(received.total.amount, unit)}</strong>
        {received.total.count !== null && ` · ${formatNumber(received.total.count)}건`}
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

/** 후원자 순위 — this month's top supporters; links to the ranking widget like funnation (받은 후원 with FLEXTV). */
export function TopDonorsCard({ donors, unit = "KRW" }: { donors: DashboardSummary["topDonors"]; unit?: AmountUnit }) {
  return (
    <SummaryCard title="후원자 순위" href={FLEXTV_STUDIO ? "/creator/donations?tab=list" : "/creator/widgets?open=RANKING"} linkLabel={FLEXTV_STUDIO ? "받은 후원" : "랭킹 위젯"}>
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
              <span className={styles.amount}>{formatAmount(d.amount, unit)}</span>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.caption}>이번 달 기준</p>
    </SummaryCard>
  );
}
