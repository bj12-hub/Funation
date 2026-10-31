import Image from "next/image";
import Link from "next/link";
import { TrophyMarkIcon, TrophyMarkSmallIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import {
  DEFAULT_RANKING_PERIOD,
  HOF_TABS,
  LEADERBOARD_STEP,
  LIVE_WINDOWS,
  RANKING_PERIOD_LABEL,
  type HofTab,
  type LiveRanking,
  type LiveWindow,
  type RankedSupporter,
  type RankingPeriod,
  type SupporterRanking,
  type SupporterTier
} from "@/services/hallOfFame/supporterRanking";
import { GLOBAL_TITLES, GRADES, GRADE_MONTHS, hasGrade, type GlobalTitleKey, type GradeKey, type TitleLine } from "@/services/supporter/identityTypes";
import styles from "./hallOfFame.module.css";
import local from "./hofTabs.module.css";

/** Row chips show the supporter's 누적 등급, coloured by its line (Figma 3:637's tier chip, 2026-10-08 등급 구조). */
const TIER_CLASS: Record<TitleLine, string> = {
  BLACK: styles.tierBlack,
  DIAMOND: styles.tierDiamond
};

const formatKrw = (amount: number) => `₩${formatNumber(amount)}`;

type T = Awaited<ReturnType<typeof getT>>;

/** Labels kept in services (tabs, periods, windows, title and grade names), in the viewer's language (2026-11-01). */
const TAB_KEY: Record<HofTab, MessageKey> = { titles: "hallOfFame.tabTitles", leaderboard: "hallOfFame.tabLeaderboard", live: "hallOfFame.tabLive" };
const PERIOD_KEY: Record<RankingPeriod, MessageKey> = { all: "hallOfFame.periodAll", month: "hallOfFame.periodMonth", week: "hallOfFame.periodWeek" };
const WINDOW_KEY: Record<LiveWindow, MessageKey> = { "30m": "hallOfFame.window30m", "1h": "hallOfFame.window1h", "3h": "hallOfFame.window3h", "6h": "hallOfFame.window6h" };
const LINE_KEY: Record<TitleLine, MessageKey> = { BLACK: "hallOfFame.lineBlack", DIAMOND: "hallOfFame.lineDiamond" };
const TITLE_KEY: Record<GlobalTitleKey, MessageKey> = {
  DIAMOND: "hallOfFame.diamond",
  BLUE_DIAMOND: "hallOfFame.blueDiamond",
  GREEN_DIAMOND: "hallOfFame.greenDiamond",
  RED_DIAMOND: "hallOfFame.redDiamond",
  PURPLE_DIAMOND: "hallOfFame.purpleDiamond",
  RAINBOW_DIAMOND: "hallOfFame.rainbowDiamond",
  BLACK_1: "hallOfFame.black1",
  BLACK_2: "hallOfFame.black2",
  BLACK_3: "hallOfFame.black3",
  BLACK_4: "hallOfFame.black4",
  BLACK_5: "hallOfFame.black5",
  BLACK_6: "hallOfFame.black6"
};
const GRADE_KEY: Record<GradeKey, MessageKey> = {
  BASIC: "hallOfFame.gradeBasic",
  SILVER: "hallOfFame.gradeSilver",
  GOLD: "hallOfFame.gradeGold",
  PLATINUM: "hallOfFame.gradePlatinum",
  MASTER: "hallOfFame.gradeMaster",
  LEGEND: "hallOfFame.gradeLegend"
};

const hofHref = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) p.set(k, String(v));
  const qs = p.toString();
  return qs ? `/hall-of-fame?${qs}` : "/hall-of-fame";
};

type Props = { tab: HofTab; ranking: SupporterRanking | null; live: LiveRanking | null };

/**
 * Hall of fame. Tabs follow funnation 명예의 전당 (칭호 갤러리 · 리더보드 · 실시간 랭킹); the hero, podium and
 * promo keep Figma ssumnation-hall-of-fame 3:637. Title names and thresholds are our placeholders (TBD).
 */
export async function HallOfFameScreen({ tab, ranking, live }: Props) {
  const t = await getT();
  return (
    <>
      <section className={styles.hero}>
        <Image src="/mock/hall-of-fame/hero.jpg" alt="" fill priority sizes="100vw" className={styles.heroImage} />
        <span className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.heroLabels}>
            <span className={styles.heroBadge}>{t("hallOfFame.title")}</span>
            <span className={styles.heroHighlight}>{t("hallOfFame.highlight")}</span>
          </div>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              <TrophyMarkIcon className={styles.heroMark} />
              {t("hallOfFame.heroTitle")}
            </h1>
            <p className={styles.heroDescription}>{t("hallOfFame.heroDescription")}</p>
          </div>
        </div>
      </section>

      <nav className={local.tabs} aria-label={t("hallOfFame.title")}>
        {HOF_TABS.map((h) => (
          <Link key={h.key} href={hofHref({ tab: h.key === "titles" ? undefined : h.key })} className={local.tab} aria-current={tab === h.key ? "page" : undefined}>
            {h.key === "titles" ? "🏅" : h.key === "leaderboard" ? "🏆" : "🔥"} {t(TAB_KEY[h.key])}
          </Link>
        ))}
      </nav>

      {tab === "titles" && <TitleGallery t={t} />}
      {tab === "leaderboard" && ranking && <Leaderboard ranking={ranking} t={t} />}
      {tab === "live" && live && <LiveBoard live={live} t={t} />}

      <section className={styles.promo} aria-labelledby="hof-promo">
        <Image src="/mock/hall-of-fame/promo.jpg" alt="" fill sizes="100vw" className={styles.promoImage} />
        <div className={styles.promoInner}>
          <div className={styles.promoText}>
            <span className={styles.promoLabel}>{t("hallOfFame.promoLabel")}</span>
            <h2 id="hof-promo" className={styles.promoTitle}>
              {t("hallOfFame.promoTitle")}
            </h2>
            <p className={styles.promoDescription}>
              {t("hallOfFame.promoDescription")}
            </p>
          </div>
          {/* 2026-10-04 결정: 후원할 크리에이터를 찾는 화면으로. */}
          <Button href="/creators" variant="light" size="lg" className={styles.promoCta}>
            {t("hallOfFame.promoCta")}
          </Button>
        </div>
      </section>
    </>
  );
}

/** 칭호 갤러리 — our 누적 등급 (다이아 · 블랙) and 활동 등급 ladders (2026-10-08 structure; thresholds are placeholders, TBD). */
function TitleGallery({ t }: { t: T }) {
  const grades = GRADES.filter((g) => hasGrade(g.key)).reverse();
  const range = (min: number, next: number | undefined) => (next ? `${formatNumber(min)} ~ ${formatNumber(next)} FN` : t("hallOfFame.fnOrMore", { min: formatNumber(min) }));
  const nextTitle = (key: GlobalTitleKey) => GLOBAL_TITLES[GLOBAL_TITLES.findIndex((x) => x.key === key) + 1]?.minFn;
  return (
    <div className={local.panel}>
      {(["BLACK", "DIAMOND"] as const).map((line) => {
        const titles = GLOBAL_TITLES.filter((x) => x.line === line).reverse();
        return (
          <section key={line} className={local.gallery} aria-labelledby={`hof-titles-${line}`}>
            <h2 id={`hof-titles-${line}`} className={local.galleryTitle}>
              {t("hallOfFame.cumulative", { line: t(LINE_KEY[line]) })}
            </h2>
            <p className={local.caption}>
              {line === "BLACK" ? t("hallOfFame.captionBlack") : t("hallOfFame.captionDiamond")} {t("hallOfFame.provisional")}
            </p>
            <ul className={local.cards}>
              {titles.map((title, i) => (
                <li key={title.key} className={local.card} data-top={(line === "BLACK" && i === 0) || undefined}>
                  <span className={local.medal} aria-hidden="true">
                    {line === "BLACK" ? "👑" : "💎"}
                  </span>
                  <strong>{t(TITLE_KEY[title.key])}</strong>
                  <span className={local.range}>{range(title.minFn, nextTitle(title.key))}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className={local.gallery} aria-labelledby="hof-grades">
        <h2 id="hof-grades" className={local.galleryTitle}>
          {t("hallOfFame.activity")}
        </h2>
        <p className={local.caption}>
          {t("hallOfFame.activityCaption", { months: GRADE_MONTHS })}
        </p>
        <ul className={local.cards}>
          {grades.map((g, i) => (
            <li key={g.key} className={local.card} data-top={i === 0 || undefined}>
              <span className={local.medal} aria-hidden="true">
                🏅
              </span>
              <strong>{t(GRADE_KEY[g.key])}</strong>
              <span className={local.range}>{range(g.minFn, grades[i - 1]?.minFn)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Leaderboard({ ranking, t }: { ranking: SupporterRanking; t: T }) {
  const podium = ranking.supporters.filter((s) => s.rank <= 3);
  const rest = ranking.supporters.filter((s) => s.rank > 3);
  const shown = ranking.supporters.length;
  const periodHref = (p: RankingPeriod) => hofHref({ tab: "leaderboard", period: p === DEFAULT_RANKING_PERIOD ? undefined : p });

  return (
    <>
      <section className={styles.section} aria-labelledby="hof-period">
        <h2 id="hof-period" className={styles.periodTitle}>
          {t("hallOfFame.tabLeaderboard")}
        </h2>
        <nav className={styles.periodTabs} aria-labelledby="hof-period">
          {(Object.keys(RANKING_PERIOD_LABEL) as RankingPeriod[]).map((p) => (
            <Link key={p} href={periodHref(p)} className={`${styles.periodTab} ${p === ranking.period ? styles.periodTabActive : ""}`} aria-current={p === ranking.period ? "page" : undefined}>
              {t(PERIOD_KEY[p])}
            </Link>
          ))}
          <span className={`${styles.periodTab} ${local.disabled}`} aria-disabled="true" title={t("common.comingSoon")}>
            {t("hallOfFame.pastRecords")}
          </span>
        </nav>
      </section>

      {ranking.supporters.length === 0 ? (
        <div className={styles.section}>
          <p className={styles.empty}>{t("hallOfFame.emptyPeriod")}</p>
        </div>
      ) : (
        <>
          <section className={styles.podiumSection} aria-label={t("hallOfFame.top3")}>
            <ol className={styles.podium}>
              {[2, 1, 3].map((rank) => {
                const supporter = podium.find((s) => s.rank === rank);
                return supporter ? <PodiumCard key={rank} supporter={supporter} t={t} /> : null;
              })}
            </ol>
          </section>
          {rest.length > 0 && (
            <section className={styles.rankingSection} aria-labelledby="hof-ranking">
              <h2 id="hof-ranking" className={styles.rankingTitle}>
                {t("hallOfFame.ranking", { last: rest.at(-1)?.rank ?? "" })}
              </h2>
              <RankList supporters={rest} t={t} />
              {shown < ranking.total && (
                <Link href={hofHref({ tab: "leaderboard", period: ranking.period === DEFAULT_RANKING_PERIOD ? undefined : ranking.period, show: shown + LEADERBOARD_STEP })} className={local.more} scroll={false}>
                  {t("hallOfFame.more", { shown, total: ranking.total })}
                </Link>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function LiveBoard({ live, t }: { live: LiveRanking; t: T }) {
  return (
    <section className={styles.rankingSection} aria-labelledby="hof-live">
      <h2 id="hof-live" className={styles.rankingTitle}>
        {t("hallOfFame.liveTitle")}
      </h2>
      <nav className={styles.periodTabs} aria-label={t("hallOfFame.window")}>
        {LIVE_WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={hofHref({ tab: "live", window: w.key === "30m" ? undefined : w.key })}
            className={`${styles.periodTab} ${w.key === live.window ? styles.periodTabActive : ""}`}
            aria-current={w.key === live.window ? "page" : undefined}
            scroll={false}
          >
            {t(WINDOW_KEY[w.key])}
          </Link>
        ))}
      </nav>
      {live.supporters.length === 0 ? <p className={styles.empty}>{t("hallOfFame.liveEmpty")}</p> : <RankList supporters={live.supporters} t={t} />}
    </section>
  );
}

function RankList({ supporters, t }: { supporters: RankedSupporter[]; t: T }) {
  return (
    <ol className={styles.rankingList}>
      {supporters.map((s) => (
        <li key={s.supporterId} className={styles.rankingRow}>
          <span className={styles.rankNumber}>{s.rank}</span>
          <span className={styles.rowAvatar}>
            <Image src={s.avatarUrl} alt="" width={44} height={44} className={styles.avatarImage} />
          </span>
          <span className={styles.rowName}>{s.nickname}</span>
          <span className={styles.rowRight}>
            <TierBadge tier={s.tier} t={t} />
            <span className={styles.amount}>
              <strong>{formatKrw(s.donationAmountKrw)}</strong>
              <span>{t("hallOfFame.donated")}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const PODIUM_CLASS: Record<number, string> = { 1: styles.first, 2: styles.second, 3: styles.third };

function PodiumCard({ supporter, t }: { supporter: RankedSupporter; t: T }) {
  const { rank } = supporter;
  return (
    <li className={`${styles.podiumCard} ${PODIUM_CLASS[rank]}`}>
      <span className={styles.podiumLabel}>
        {rank === 1 && <TrophyMarkSmallIcon />}
        {t("hallOfFame.podiumRank", { rank })}
      </span>
      <span className={styles.podiumRing}>
        <Image src={supporter.avatarUrl} alt="" width={94} height={104} className={styles.podiumAvatar} />
      </span>
      <span className={styles.podiumText}>
        <strong className={styles.podiumName}>{supporter.nickname}</strong>
        <span className={styles.podiumAmount}>{formatKrw(supporter.donationAmountKrw)}</span>
      </span>
      <TierBadge tier={supporter.tier} t={t} />
    </li>
  );
}

function TierBadge({ tier, t }: { tier: SupporterTier; t: T }) {
  if (!tier) return null;
  const line = GLOBAL_TITLES.find((x) => x.key === tier)!.line;
  return <span className={`${styles.tier} ${TIER_CLASS[line]}`}>{t(TITLE_KEY[tier])}</span>;
}
