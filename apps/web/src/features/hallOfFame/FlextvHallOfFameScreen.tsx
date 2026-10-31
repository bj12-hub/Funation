import Image from "next/image";
import Link from "next/link";
import { TrophyMarkIcon } from "@/components/icons";
import { HALL_OF_FAME_BADGE_IMAGES } from "@/lib/flextv/events";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
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
export async function FlextvHallOfFameScreen({ view }: { view: FlextvHallOfFameView }) {
  const t = await getT();
  return (
    <>
      <section className={styles.hero}>
        <Image src="/mock/hall-of-fame/hero.jpg" alt="" fill priority sizes="100vw" className={styles.heroImage} />
        <span className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.heroLabels}>
            <span className={styles.heroBadge}>{t("hallOfFame.title")}</span>
            <span className={styles.heroHighlight}>{t("flextvHallOfFame.highlight")}</span>
          </div>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              <TrophyMarkIcon className={styles.heroMark} />
              {t("flextvHallOfFame.heroTitle")}
            </h1>
            <p className={styles.heroDescription}>{t("flextvHallOfFame.heroDescription")}</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="hof-month">
        <h2 id="hof-month" className={styles.periodTitle}>
          {t("flextvHallOfFame.monthTitle", { month: monthLabel(view.month) })}
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
            <select name="month" defaultValue={view.month} aria-label={t("flextvHallOfFame.monthPicker")} className={local.monthSelect}>
              {view.months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button type="submit" className={local.monthGo}>
              {t("flextvHallOfFame.show")}
            </button>
          </form>
        )}
      </section>

      {view.rows.length === 0 ? (
        <div className={styles.section}>
          <p className={styles.empty}>{t("flextvHallOfFame.empty")}</p>
        </div>
      ) : (
        <section className={styles.rankingSection} aria-labelledby="hof-ranking">
          <h2 id="hof-ranking" className={styles.rankingTitle}>
            {t("flextvHallOfFame.ranking")}
          </h2>
          <ol className={styles.rankingList}>
            {view.rows.map((r) => (
              <li key={`${r.rank}-${r.nickname}`} className={styles.rankingRow}>
                <span className={styles.rankNumber}>{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                <span className={styles.rowName}>{r.channelId ? <Link href={`/creators/${r.channelId}`}>{r.nickname}</Link> : r.nickname}</span>
                <span className={styles.rowRight}>
                  {r.badges.some((b) => b.count > 0) && (
                    <span className={local.hofBadges} aria-label={t("flextvHallOfFame.badges")}>
                      {r.badges.map((b) => (
                        <span key={b.id} className={local.hofBadge}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts */}
                          <img src={HALL_OF_FAME_BADGE_IMAGES[b.id]} alt={t("flextvHallOfFame.badge", { id: b.id })} width={24} height={24} />× {formatNumber(b.count)}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className={styles.amount}>
                    {t("flextvHallOfFame.points")}
                    <strong>{formatNumber(r.points)}</strong>
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className={local.caption}>{t("flextvHallOfFame.caption")}</p>
        </section>
      )}
    </>
  );
}
