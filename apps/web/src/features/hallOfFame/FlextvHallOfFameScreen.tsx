import Image from "next/image";
import Link from "next/link";
import { TrophyMarkIcon } from "@/components/icons";
import { HALL_OF_FAME_BADGE_IMAGES } from "@/lib/flextv/events";
import { formatNumber } from "@/lib/format";
import type { FlextvHallOfFameView } from "@/services/hallOfFame/flextvHallOfFame";
import styles from "./hallOfFame.module.css";
import local from "./hofTabs.module.css";

const monthLabel = (m: string) => `${m.slice(0, 4)}.${m.slice(4, 6)}`;
/** The latest months are chips; every month is in the picker (a plain GET form, so it works without JavaScript). */
const CHIP_MONTHS = 6;

/**
 * 명예의 전당 with FLEXTV (phase 9; the hero keeps Figma ssumnation-hall-of-fame 3:637, the board follows FLEXTV's
 * 명예의 전당). Route `/hall-of-fame` (`?month=YYYYMM`): FLEXTV's top supporters of the month by 후원 점수, with their
 * accumulated badges; a supporter with a channel links to it.
 */
export function FlextvHallOfFameScreen({ view }: { view: FlextvHallOfFameView }) {
  return (
    <>
      <section className={styles.hero}>
        <Image src="/mock/hall-of-fame/hero.jpg" alt="" fill priority sizes="100vw" className={styles.heroImage} />
        <span className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.heroLabels}>
            <span className={styles.heroBadge}>명예의 전당</span>
            <span className={styles.heroHighlight}>이달의 서포터</span>
          </div>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              <TrophyMarkIcon className={styles.heroMark} />
              크리에이터를 빛나게 해 주신 최고의 서포터들
            </h1>
            <p className={styles.heroDescription}>FLEXTV 후원 점수로 매달 집계해요. 지난달의 명예의 전당도 볼 수 있어요.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="hof-month">
        <h2 id="hof-month" className={styles.periodTitle}>
          {monthLabel(view.month)} 명예의 전당
        </h2>
        <nav className={styles.periodTabs} aria-labelledby="hof-month">
          {view.months.slice(0, CHIP_MONTHS).map((m, i) => (
            <Link key={m} href={i === 0 ? "/hall-of-fame" : `/hall-of-fame?month=${m}`} className={`${styles.periodTab} ${m === view.month ? styles.periodTabActive : ""}`} aria-current={m === view.month ? "page" : undefined}>
              {monthLabel(m)}
            </Link>
          ))}
        </nav>
        {view.months.length > CHIP_MONTHS && (
          <form action="/hall-of-fame" className={local.monthForm}>
            <select name="month" defaultValue={view.month} aria-label="명예의 전당 달" className={local.monthSelect}>
              {view.months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button type="submit" className={local.monthGo}>
              보기
            </button>
          </form>
        )}
      </section>

      {view.rows.length === 0 ? (
        <div className={styles.section}>
          <p className={styles.empty}>이 달에는 아직 집계된 후원이 없어요.</p>
        </div>
      ) : (
        <section className={styles.rankingSection} aria-labelledby="hof-ranking">
          <h2 id="hof-ranking" className={styles.rankingTitle}>
            🏆 서포터 랭킹
          </h2>
          <ol className={styles.rankingList}>
            {view.rows.map((r) => (
              <li key={`${r.rank}-${r.nickname}`} className={styles.rankingRow}>
                <span className={styles.rankNumber}>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                <span className={styles.rowName}>{r.channelId ? <Link href={`/creators/${r.channelId}`}>{r.nickname}</Link> : r.nickname}</span>
                <span className={styles.rowRight}>
                  {r.badges.some((b) => b.count > 0) && (
                    <span className={local.hofBadges} aria-label="누적 뱃지">
                      {r.badges.map((b) => (
                        <span key={b.id} className={local.hofBadge}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts */}
                          <img src={HALL_OF_FAME_BADGE_IMAGES[b.id]} alt={`뱃지 ${b.id}`} width={24} height={24} />× {formatNumber(b.count)}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className={styles.amount}>
                    후원 점수
                    <strong>{formatNumber(r.points)}</strong>
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className={local.caption}>FLEXTV 명예의 전당 기준이에요. 이번 달은 집계 중이라 순위가 바뀔 수 있어요.</p>
        </section>
      )}
    </>
  );
}
