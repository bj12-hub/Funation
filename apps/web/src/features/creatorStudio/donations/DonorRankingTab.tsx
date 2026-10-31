import Image from "next/image";
import Link from "next/link";
import { DefaultAvatarIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translate";
import { RANK_PERIODS, type DonorRanking, type RankPeriod } from "@/services/creator/donationManagementTypes";
import { koT, type T } from "./translator";
import styles from "./donations.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];
const PERIOD_KEY: Record<RankPeriod, MessageKey> = {
  day: "studioDonationsList.rankDay",
  week: "studioDonationsList.rankWeek",
  month: "studioDonationsList.rankMonth",
  season: "studioDonationsList.rankSeason"
};

function Change({ value, t }: { value: number; t: T }) {
  if (value === 0)
    return (
      <span className={styles.same} aria-label={t("studioDonationsList.noChange")}>
        -
      </span>
    );
  return (
    <span className={value > 0 ? styles.up : styles.down} aria-label={t(value > 0 ? "studioDonationsList.rankUp" : "studioDonationsList.rankDown", { n: Math.abs(value) })}>
      {value > 0 ? "▲" : "▼"} {formatNumber(Math.abs(value))}
    </span>
  );
}

function Avatar({ src, size }: { src: string | null; size: number }) {
  return src ? (
    <Image src={src} alt="" width={size} height={size} className={styles.avatar} style={{ width: size, height: size }} />
  ) : (
    <DefaultAvatarIcon width={size} height={size} className={styles.avatar} />
  );
}

/**
 * 후원 순위 — Figma 539:303. Ranks this creator's supporters. 랭킹 포인트 and 성공 기여율 formulas are TBD.
 * The design writes amounts in 원; FN is shown since donations are recorded in FN. `t`: the page's translator (getT).
 */
export function DonorRankingTab({ data, t = koT }: { data: DonorRanking; t?: T }) {
  const { top, rows, period } = data;
  return (
    <div className={styles.stack}>
      {top && (
        <section className={styles.topCard} aria-label={t("studioDonationsList.myRanking")}>
          <div className={styles.topLeft}>
            <div className={styles.topRank}>
              <span className={styles.label}>{t("studioDonationsList.myRanking")}</span>
              <strong>
                {t("studioDonationsList.bestRank", { rank: top.rank })} <Change value={top.change} t={t} />
              </strong>
            </div>
            <span className={styles.divider} aria-hidden="true" />
            <Avatar src={top.avatarUrl} size={48} />
            <div className={styles.topName}>
              <strong>{top.nickname}</strong>
              <span>{t("studioDonationsList.points", { points: formatNumber(top.points) })}</span>
            </div>
          </div>
          <dl className={styles.topStats}>
            <div>
              <dt>{t("studioDonationsList.totalAmount")}</dt>
              <dd className={styles.teal}>{formatNumber(top.totalAmount)} FN</dd>
            </div>
            <div>
              <dt>{t("studioDonationsList.donationCount")}</dt>
              <dd>{t("studioDonationsList.times", { count: formatNumber(top.count) })}</dd>
            </div>
          </dl>
        </section>
      )}

      <nav className={styles.periods} aria-label={t("studioDonationsList.periodAria")}>
        {RANK_PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/creator/donations?tab=ranking&period=${p.key}`}
            className={p.key === period ? styles.periodOn : undefined}
            aria-current={p.key === period ? "true" : undefined}
          >
            {t(PERIOD_KEY[p.key])}
          </Link>
        ))}
      </nav>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>{t("studioDonationsList.rankCaption")}</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 100 }}>
                {t("studioDonationsList.colRank")}
              </th>
              <th scope="col" style={{ width: 90 }}>
                {t("studioDonationsList.colChange")}
              </th>
              <th scope="col">{t("studioDonationsList.colDonorInfo")}</th>
              <th scope="col" style={{ width: 160 }}>
                {t("studioDonationsList.colPoints")}
              </th>
              <th scope="col" style={{ width: 120 }}>
                {t("studioDonationsList.colCount")}
              </th>
              <th scope="col" className={styles.right} style={{ width: 120 }}>
                {t("studioDonationsList.colSuccess")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  {t("studioDonationsList.rankEmpty")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.rank} className={r.rank <= 3 ? styles.topRow : undefined}>
                  <td className={styles.rankCell}>
                    {r.rank <= 3 && <span aria-hidden="true">{MEDALS[r.rank - 1]}</span>}
                    {r.rank}
                  </td>
                  <td>
                    <Change value={r.change} t={t} />
                  </td>
                  <td>
                    <span className={styles.donor}>
                      <Avatar src={r.avatarUrl} size={32} />
                      <span className={styles.ellipsis}>{r.nickname}</span>
                    </span>
                  </td>
                  <td>
                    <span className={styles.points}>
                      {formatNumber(r.points)}
                      <span className={styles.dot} aria-hidden="true" />
                    </span>
                  </td>
                  <td className={styles.muted}>{formatNumber(r.count)}</td>
                  <td className={`${styles.right} ${styles.teal}`}>{r.successRate}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
