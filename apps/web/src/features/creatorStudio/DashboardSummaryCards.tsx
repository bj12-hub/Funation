import Link from "next/link";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
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
export async function ReceivedCard({ received, unit = "KRW" }: { received: DashboardSummary["received"]; unit?: AmountUnit }) {
  const t = await getT();
  const tiles = [
    [t("studioDashboard.today"), received.today],
    [t("studioDashboard.thisWeek"), received.week],
    [t("studioDashboard.thisMonth"), received.month]
  ] as const;
  return (
    <SummaryCard title={t("studioDashboard.received")} href="/creator/donations?tab=list" linkLabel={t("studioDashboard.receivedLink")}>
      <div className={styles.tiles}>
        {tiles.map(([label, tile]) => (
          <div key={label} className={styles.tile}>
            <span className={styles.tileLabel}>{label}</span>
            <strong className={styles.tileValue}>{formatAmount(tile.amount, unit)}</strong>
            <span className={styles.tileSub}>{t("studioDashboard.countValue", { count: formatNumber(tile.count) })}</span>
          </div>
        ))}
      </div>
      <p className={styles.total}>
        {t("studioDashboard.total")} <strong>{formatAmount(received.total.amount, unit)}</strong>
        {received.total.count !== null && ` · ${t("studioDashboard.countValue", { count: formatNumber(received.total.count) })}`}
      </p>
    </SummaryCard>
  );
}

/** 정산 — 정산 가능 · 누적 수익 · 누적 출금 (FN, settlement records). */
export async function SettlementCard({ settlement }: { settlement: DashboardSummary["settlement"] }) {
  const t = await getT();
  const tiles = [
    [t("studioDashboard.available"), settlement.availableFn],
    [t("studioDashboard.earned"), settlement.earnedFn],
    [t("studioDashboard.withdrawn"), settlement.withdrawnFn]
  ] as const;
  return (
    <SummaryCard title={t("studioDashboard.settlement")} href="/creator/settlement/apply" linkLabel={t("studioDashboard.settlementLink")}>
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
export async function TopDonorsCard({ donors, unit = "KRW" }: { donors: DashboardSummary["topDonors"]; unit?: AmountUnit }) {
  const t = await getT();
  return (
    <SummaryCard
      title={t("studioDashboard.topDonors")}
      href={FLEXTV_STUDIO ? "/creator/donations?tab=list" : "/creator/widgets?open=RANKING"}
      linkLabel={t(FLEXTV_STUDIO ? "studioDashboard.topDonorsLinkFlextv" : "studioDashboard.topDonorsLink")}
    >
      {donors.length === 0 ? (
        <p className={styles.empty}>{t("studioDashboard.topDonorsEmpty")}</p>
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
      <p className={styles.caption}>{t("studioDashboard.thisMonthBasis")}</p>
    </SummaryCard>
  );
}
