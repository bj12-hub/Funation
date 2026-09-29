import Image from "next/image";
import Link from "next/link";
import { DefaultAvatarIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { RANK_PERIODS, type DonorRanking } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

const MEDALS = ["🥇", "🥈", "🥉"];

function Change({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className={styles.same} aria-label="변동 없음">
        -
      </span>
    );
  return (
    <span className={value > 0 ? styles.up : styles.down} aria-label={`${Math.abs(value)} ${value > 0 ? "상승" : "하락"}`}>
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
 * The design writes amounts in 원; FN is shown since donations are recorded in FN.
 */
export function DonorRankingTab({ data }: { data: DonorRanking }) {
  const { top, rows, period } = data;
  return (
    <div className={styles.stack}>
      {top && (
        <section className={styles.topCard} aria-label="내 누적 후원 랭킹">
          <div className={styles.topLeft}>
            <div className={styles.topRank}>
              <span className={styles.label}>내 누적 후원 랭킹</span>
              <strong>
                최고 {top.rank}위 <Change value={top.change} />
              </strong>
            </div>
            <span className={styles.divider} aria-hidden="true" />
            <Avatar src={top.avatarUrl} size={48} />
            <div className={styles.topName}>
              <strong>{top.nickname}</strong>
              <span>종합 랭킹포인트 {formatNumber(top.points)}</span>
            </div>
          </div>
          <dl className={styles.topStats}>
            <div>
              <dt>총 후원금액</dt>
              <dd className={styles.teal}>{formatNumber(top.totalAmount)} FN</dd>
            </div>
            <div>
              <dt>후원 횟수</dt>
              <dd>{formatNumber(top.count)}회</dd>
            </div>
          </dl>
        </section>
      )}

      <nav className={styles.periods} aria-label="기간">
        {RANK_PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/creator/donations?tab=ranking&period=${p.key}`}
            className={p.key === period ? styles.periodOn : undefined}
            aria-current={p.key === period ? "true" : undefined}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>후원자 순위</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 100 }}>
                순위
              </th>
              <th scope="col" style={{ width: 90 }}>
                변동
              </th>
              <th scope="col">후원자 정보</th>
              <th scope="col" style={{ width: 160 }}>
                랭킹 포인트
              </th>
              <th scope="col" style={{ width: 120 }}>
                후원 횟수
              </th>
              <th scope="col" className={styles.right} style={{ width: 120 }}>
                성공 기여율
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  아직 집계된 후원 순위가 없습니다.
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
                    <Change value={r.change} />
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
