import Image from "next/image";
import Link from "next/link";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { CreatorDashboard, CreatorProfile, DashboardSummary } from "@/services/creator/creatorStudio";
import type { UpdatesView } from "@/services/creator/updatesTypes";
import { formatAmount } from "./amount";
import { ReceivedCard, SettlementCard, TopDonorsCard } from "./DashboardSummaryCards";
import { LinkActions, RankingTabs } from "./DashboardWidgets";
import summary from "./dashboardSummary.module.css";
import { RevenueChart } from "./RevenueChart";
import { StatsFilter } from "./StatsFilter";
import styles from "./studio.module.css";
import { UpdatesCard } from "./updates/UpdatesCard";

type T = Awaited<ReturnType<typeof getT>>;

/** Server-side relative time ("10분 전"), so server and client HTML match. */
function timeAgo(iso: string, t: T) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t("studioDashboard.justNow");
  if (minutes < 60) return t("studioDashboard.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("studioDashboard.hoursAgo", { n: hours });
  return t("studioDashboard.daysAgo", { n: Math.floor(hours / 24) });
}

/**
 * Creator dashboard. Figma 245:14 (route `/creator`).
 * Amounts are ₩ as in the design and come from the server as-is (gross/net and fees are TBD); with FLEXTV they are the
 * 렉스 received, in FN (`dashboard.unit`).
 */
export async function CreatorDashboardScreen({
  profile,
  dashboard,
  updates,
  summary: data
}: {
  profile: CreatorProfile;
  dashboard: CreatorDashboard;
  updates: UpdatesView | null;
  summary: DashboardSummary | null;
}) {
  const { stats, period } = dashboard;
  const t = await getT();
  return (
    <div className={styles.content}>
      <h1 className={summary.pageTitle}>{t("studioDashboard.title")}</h1>
      {/* Top cards follow the funnation dashboard: 내 채널 · 받은 후원 · 정산 · 후원자 순위 · 소식 (code-first). */}
      <div className={summary.grid}>
        <section className={`${styles.card} ${styles.infoCard}`} aria-label={t("studioDashboard.myChannel")}>
          {profile.avatarUrl ? (
            <Image src={profile.avatarUrl} alt="" width={80} height={80} className={styles.infoAvatar} />
          ) : (
            <span className={styles.infoAvatar} aria-hidden="true" />
          )}
          <div className={styles.infoText}>
            <strong className={styles.channelName}>{profile.channelName}</strong>
            <span className={styles.handle}>@{profile.handle}</span>
            <div className={styles.linkRow}>
              <span className={styles.linkText}>
                {t("studioDashboard.myDonateLink")}
                <br />: {profile.donateUrl.replace(/^https?:\/\//, "https://")}
              </span>
              <LinkActions url={profile.donateUrl} />
            </div>
            <div className={styles.infoButtons}>
              {/* With FLEXTV the channel's settings are its 방송 설정 (phase 5). */}
              <Link href={FLEXTV_STUDIO ? "/creator/broadcast" : "/creator/settings"} className={styles.gradientPill}>
                {t(FLEXTV_STUDIO ? "studioDashboard.broadcastSettings" : "studioDashboard.account")}
              </Link>
              {/* 정산 관리 (478:2); unregistered creators are sent to the settlement home (429:4). */}
              <Link href="/creator/settlement/manage" className={styles.outlinePill}>
                {t("studioDashboard.settlementManage")}
              </Link>
            </div>
          </div>
        </section>

        {data && <ReceivedCard received={data.received} unit={data.unit} />}
        {data && <SettlementCard settlement={data.settlement} />}
        {data && <TopDonorsCard donors={data.topDonors} unit={data.unit} />}
        {updates && <UpdatesCard view={updates} />}
        {(dashboard.banners.event || dashboard.banners.ad) && (
        <section className={`${styles.card} ${styles.quickCard}`} aria-label={t("studioDashboard.quickAria")}>
          {dashboard.banners.event && (
            <div className={styles.quickItem}>
              <h2 className={styles.quickTitle}>{t("studioDashboard.event")}</h2>
              <Image src={dashboard.banners.event.imageUrl} alt={dashboard.banners.event.alt} width={268} height={111} priority className={`${styles.banner} ${styles.bannerEvent}`} />
            </div>
          )}
          {dashboard.banners.ad && (
            <div className={styles.quickItem}>
              <h2 className={styles.quickTitle}>{t("studioDashboard.ad")}</h2>
              <Image src={dashboard.banners.ad.imageUrl} alt={dashboard.banners.ad.alt} width={268} height={111} className={`${styles.banner} ${styles.bannerAd}`} />
            </div>
          )}
        </section>
        )}
      </div>

      <section className={styles.statsSection} aria-labelledby="creator-stats">
        <h2 id="creator-stats" className={styles.sectionTitle}>
          {t("studioDashboard.stats")}
        </h2>
        <StatsFilter key={`${period.preset}${period.from}${period.to}`} period={period} />
        <div className={styles.statCards}>
          <div className={styles.statCard}>
            <span>{t("studioDashboard.statCount")}</span>
            <strong>{t("studioDashboard.timesValue", { count: formatNumber(stats.count) })}</strong>
          </div>
          <div className={styles.statCard}>
            <span>{t("studioDashboard.statRevenue")}</span>
            <strong>{formatAmount(stats.revenue, dashboard.unit)}</strong>
          </div>
          <div className={styles.statCard}>
            <span>{t("studioDashboard.statDonors")}</span>
            <strong>{t("studioDashboard.peopleValue", { count: formatNumber(stats.donors) })}</strong>
          </div>
        </div>
        <div className={`${styles.card} ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>{t("studioDashboard.chartTitle")}</h3>
          <div className={styles.chartArea}>
            <RevenueChart series={dashboard.series} unit={dashboard.unit} />
          </div>
        </div>
        {dashboard.partial && <p className={styles.chartEmpty}>{t("studioDashboard.partial")}</p>}
      </section>

      <div className={styles.bottomRow}>
        <section className={styles.recentSection} aria-labelledby="creator-recent">
          <h2 id="creator-recent" className={styles.sectionTitle}>
            {t("studioDashboard.recent")}
          </h2>
          <div className={`${styles.card} ${styles.tableCard}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("studioDashboard.colDonor")}</th>
                  <th scope="col">{t("studioDashboard.colAmount")}</th>
                  <th scope="col">{t("studioDashboard.colMessage")}</th>
                  <th scope="col" className={styles.right}>
                    {t("studioDashboard.colDate")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      {t("studioDashboard.recentEmpty")}
                    </td>
                  </tr>
                ) : (
                  dashboard.recent.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className={styles.donor}>
                          <span className={styles.donorDot} aria-hidden="true" />
                          {r.donor}
                        </span>
                      </td>
                      <td className={styles.money}>{formatAmount(r.amount, dashboard.unit)}</td>
                      <td className={styles.message} title={r.message}>
                        {r.message}
                      </td>
                      <td className={`${styles.time} ${styles.right}`}>{timeAgo(r.createdAt, t)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <RankingTabs rankings={dashboard.rankings} unit={dashboard.unit} />
      </div>
    </div>
  );
}
