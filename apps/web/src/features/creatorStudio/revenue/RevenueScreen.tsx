import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getLocale, getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import type { AmountUnit, RevenueOverview, RevenueShare } from "@/services/creator/creatorStudio";
import { formatAmount } from "../amount";
import { SummaryCard, TopDonorsCard } from "../DashboardSummaryCards";
import { RevenueChart } from "../RevenueChart";
import summary from "../dashboardSummary.module.css";
import studio from "../studio.module.css";
import styles from "./revenue.module.css";

/**
 * 수익 현황 — code-first, structure follows the funnation 수익 대시보드: 총 수익 · 미정산 · 오늘 후원 ·
 * 이번 달 tiles with 정산 요청, 일별 후원 추이 (30일), 월별 수익 추이 (6개월), 상위 후원자 and shortcuts.
 * Route `/creator/revenue`. ₩ amounts are server values (gross/net TBD); 미정산 is FN. With FLEXTV every amount is the
 * 렉스 received (FN) and 수익원별 상세 is left out (FLEXTV does not tell the types apart).
 */
/** 수익원 labels by the service's key; a key not listed shows the service's label. */
const SOURCE_KEY: Record<string, MessageKey> = {
  TEXT: "studioRevenue.typeText",
  SIGNATURE: "studioRevenue.typeSignature",
  MINI: "studioRevenue.typeMini",
  VIDEO: "studioRevenue.typeVideo",
  QUEST: "studioRevenue.typeQuest",
  ROULETTE: "studioRevenue.typeRoulette",
  GACHA: "studioRevenue.typeGacha",
  WISHLIST: "studioRevenue.typeWishlist",
  DRAWING: "studioRevenue.typeDrawing",
  DIRECT: "studioRevenue.routeDirect",
  SOOP: "studioRevenue.routeSoop",
  FLEXTV: "studioRevenue.routeFlextv"
};

/** The service's month label ("6월") as a short month name in English (Jun); Korean keeps it. */
function monthLabel(label: string, locale: Locale) {
  const m = /^(\d{1,2})월$/.exec(label);
  return m && locale === "en" ? new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(Date.UTC(2000, Number(m[1]) - 1, 1)) : label;
}

export async function RevenueScreen({ data }: { data: RevenueOverview }) {
  const empty = data.totalRevenue === 0;
  const { unit } = data;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const shares = (items: RevenueShare[]) => items.map((i) => (SOURCE_KEY[i.key] ? { ...i, label: t(SOURCE_KEY[i.key]) } : i));
  return (
    <div className={studio.content}>
      <header className={styles.header}>
        <div>
          <h1 className={summary.pageTitle}>{t("studioRevenue.title")}</h1>
          <p className={styles.subtitle}>{t("studioRevenue.subtitle")}</p>
        </div>
        <Link href="/creator/settlement/apply" className={styles.primary}>
          {t("studioRevenue.requestSettlement")}
        </Link>
      </header>

      <div className={styles.tiles}>
        <Tile label={t("studioRevenue.total")} sub={t("studioRevenue.allTime")} value={formatAmount(data.totalRevenue, unit)} />
        <Tile
          label={t("studioRevenue.unsettled")}
          sub={data.unsettledFn > 0 ? t("studioRevenue.unsettledSome") : t("studioRevenue.unsettledNone")}
          value={`${formatNumber(data.unsettledFn)} FN`}
        />
        <Tile label={t("studioRevenue.today")} sub={t("studioRevenue.countValue", { count: formatNumber(data.today.count) })} value={formatAmount(data.today.amount, unit)} />
        <Tile label={t("studioRevenue.thisMonth")} sub={t("studioRevenue.sinceFirst")} value={formatAmount(data.thisMonth, unit)} />
      </div>
      {unit === "FN" && <p className={styles.subtitle}>{t("studioRevenue.flextvNote")}</p>}
      {data.partial && <p className={styles.subtitle}>{t("studioRevenue.partial")}</p>}

      {empty ? (
        <p className={styles.empty}>{t("studioRevenue.empty")}</p>
      ) : (
        <div className={summary.grid}>
          <SummaryCard title={t("studioRevenue.daily")} href="/creator/donations?tab=list" linkLabel={t("studioRevenue.received")}>
            <p className={styles.range}>
              {data.daily[0].label} ~ {data.daily[data.daily.length - 1].label} {t("studioRevenue.last30")}
            </p>
            <div className={studio.chartArea}>
              <RevenueChart series={data.daily} fillId="revenue-fill-daily" unit={unit} />
            </div>
          </SummaryCard>
          <SummaryCard title={t("studioRevenue.monthly")} href="/creator/settlement/manage" linkLabel={t("studioRevenue.manage")}>
            <p className={styles.range}>{t("studioRevenue.last6")}</p>
            <div className={studio.chartArea}>
              <RevenueChart series={data.monthly.map((m) => ({ ...m, label: monthLabel(m.label, locale) }))} fillId="revenue-fill-monthly" unit={unit} />
            </div>
          </SummaryCard>
          <TopDonorsCard donors={data.topDonors} unit={unit} />
          {data.bySource && (
            <section className={summary.card} aria-labelledby="revenue-sources">
              <h2 id="revenue-sources" className={summary.title}>
                {t("studioRevenue.sources")}
              </h2>
              <p className={styles.range}>
                {t("studioRevenue.thisMonth")} · {formatAmount(data.thisMonth, unit)}
              </p>
              <ShareList title={t("studioRevenue.byType")} items={shares(data.bySource.types)} total={data.thisMonth} unit={unit} />
              <ShareList title={t("studioRevenue.byRoute")} items={shares(data.bySource.routes)} total={data.thisMonth} unit={unit} />
            </section>
          )}
          <section className={summary.card} aria-labelledby="revenue-links">
            <h2 id="revenue-links" className={summary.title}>
              {t("studioRevenue.shortcuts")}
            </h2>
            <ul className={styles.links}>
              <li>
                <Link href="/creator/donations?tab=list">
                  <strong>{t("studioRevenue.received")}</strong>
                  <span>{t("studioRevenue.receivedDesc")}</span>
                </Link>
              </li>
              <li>
                <Link href="/creator/settlement">
                  <strong>{t("studioRevenue.settlementStatus")}</strong>
                  <span>{t("studioRevenue.settlementStatusDesc")}</span>
                </Link>
              </li>
              <li>
                <Link href="/creator/settlement/apply">
                  <strong>{t("studioRevenue.requestSettlement")}</strong>
                  <span>{t("studioRevenue.requestSettlementDesc")}</span>
                </Link>
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

/** One breakdown: label, ₩ and share, with a bar (code-first, 2026-10-06). */
function ShareList({ title, items, total, unit }: { title: string; items: RevenueShare[]; total: number; unit: AmountUnit }) {
  return (
    <div className={styles.shares}>
      <h3 className={styles.sharesTitle}>{title}</h3>
      <ul className={styles.shareList}>
        {items.map((i) => {
          const pct = total > 0 ? Math.round((i.amount / total) * 1000) / 10 : 0;
          return (
            <li key={i.key} className={styles.share}>
              <span className={styles.shareLabel}>{i.label}</span>
              <span className={styles.shareValue}>
                {formatAmount(i.amount, unit)} <span className={styles.sharePct}>{pct}%</span>
              </span>
              <span className={styles.shareBar} aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
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
