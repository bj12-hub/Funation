import Image from "next/image";
import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { CreatorDashboard, CreatorProfile } from "@/services/creator/creatorStudio";
import { LinkActions, RankingTabs } from "./DashboardWidgets";
import { RevenueChart } from "./RevenueChart";
import { StatsFilter } from "./StatsFilter";
import styles from "./studio.module.css";

/** Server-side relative time ("10분 전"), so server and client HTML match. */
function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

/**
 * Creator dashboard. Figma 245:14 (route `/creator`).
 * Amounts are ₩ as in the design and come from the server as-is (gross/net and fees are TBD).
 */
export function CreatorDashboardScreen({ profile, dashboard }: { profile: CreatorProfile; dashboard: CreatorDashboard }) {
  const { stats, period } = dashboard;
  return (
    <div className={styles.content}>
      <div className={styles.topRow}>
        <section className={`${styles.card} ${styles.infoCard}`} aria-label="내 방송 정보">
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
                내 후원링크
                <br />: {profile.donateUrl.replace(/^https?:\/\//, "https://")}
              </span>
              <LinkActions url={profile.donateUrl} />
            </div>
            <div className={styles.infoButtons}>
              <Link href="/creator/settings" className={styles.gradientPill}>
                계정 관리
              </Link>
              {/* 정산 관리 (478:2); unregistered creators are sent to the settlement home (429:4). */}
              <Link href="/creator/settlement/manage" className={styles.outlinePill}>
                정산 관리
              </Link>
            </div>
          </div>
        </section>

        <section className={`${styles.card} ${styles.quickCard}`} aria-label="이벤트 및 크리애드">
          {dashboard.banners.event && (
            <div className={styles.quickItem}>
              <h2 className={styles.quickTitle}>이벤트</h2>
              <Image src={dashboard.banners.event.imageUrl} alt={dashboard.banners.event.alt} width={268} height={111} className={`${styles.banner} ${styles.bannerEvent}`} />
            </div>
          )}
          {dashboard.banners.ad && (
            <div className={styles.quickItem}>
              <h2 className={styles.quickTitle}>크리애드</h2>
              <Image src={dashboard.banners.ad.imageUrl} alt={dashboard.banners.ad.alt} width={268} height={111} className={`${styles.banner} ${styles.bannerAd}`} />
            </div>
          )}
        </section>
      </div>

      <section className={styles.statsSection} aria-labelledby="creator-stats">
        <h2 id="creator-stats" className={styles.sectionTitle}>
          후원 통계
        </h2>
        <StatsFilter key={`${period.preset}${period.from}${period.to}`} period={period} />
        <div className={styles.statCards}>
          <div className={styles.statCard}>
            <span>후원 횟수</span>
            <strong>{formatNumber(stats.count)}회</strong>
          </div>
          <div className={styles.statCard}>
            <span>후원 수익</span>
            <strong>₩{formatNumber(stats.revenue)}</strong>
          </div>
          <div className={styles.statCard}>
            <span>후원 인원수</span>
            <strong>{formatNumber(stats.donors)}명</strong>
          </div>
        </div>
        <div className={`${styles.card} ${styles.chartCard}`}>
          <h3 className={styles.chartTitle}>기간별 수익 그래프</h3>
          <div className={styles.chartArea}>
            <RevenueChart series={dashboard.series} />
          </div>
        </div>
      </section>

      <div className={styles.bottomRow}>
        <section className={styles.recentSection} aria-labelledby="creator-recent">
          <h2 id="creator-recent" className={styles.sectionTitle}>
            최근 후원 내역
          </h2>
          <div className={`${styles.card} ${styles.tableCard}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">후원자</th>
                  <th scope="col">금액</th>
                  <th scope="col">메시지</th>
                  <th scope="col" className={styles.right}>
                    날짜
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={styles.empty}>
                      아직 받은 후원이 없습니다.
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
                      <td className={styles.money}>₩{formatNumber(r.amount)}</td>
                      <td className={styles.message} title={r.message}>
                        {r.message}
                      </td>
                      <td className={`${styles.time} ${styles.right}`}>{timeAgo(r.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        <RankingTabs rankings={dashboard.rankings} />
      </div>
    </div>
  );
}
