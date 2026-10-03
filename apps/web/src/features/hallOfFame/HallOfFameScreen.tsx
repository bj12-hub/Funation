import Image from "next/image";
import Link from "next/link";
import { TrophyMarkIcon, TrophyMarkSmallIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import {
  DEFAULT_RANKING_PERIOD,
  HOF_TABS,
  LEADERBOARD_STEP,
  LIVE_WINDOWS,
  RANKING_PERIOD_LABEL,
  type HofTab,
  type LiveRanking,
  type RankedSupporter,
  type RankingPeriod,
  type SupporterRanking,
  type SupporterTier
} from "@/services/hallOfFame/supporterRanking";
import { GLOBAL_TITLES, GRADES } from "@/services/supporter/identityTypes";
import styles from "./hallOfFame.module.css";
import local from "./hofTabs.module.css";

const TIER_CLASS: Record<SupporterTier, string> = {
  DIAMOND: styles.tierDiamond,
  GOLD: styles.tierGold,
  SILVER: styles.tierSilver,
  BRONZE: styles.tierBronze
};

const formatKrw = (amount: number) => `₩${formatNumber(amount)}`;

const hofHref = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) p.set(k, String(v));
  const qs = p.toString();
  return qs ? `/hall-of-fame?${qs}` : "/hall-of-fame";
};

type Props = { tab: HofTab; ranking: SupporterRanking | null; live: LiveRanking | null };

/**
 * Hall of fame. Tabs follow funnation 명예의 전당 (칭호 갤러리 · 리더보드 · 실시간 랭킹); the hero, podium and
 * promo keep Figma funation-hall-of-fame 3:637. Title names and thresholds are our placeholders (TBD).
 */
export function HallOfFameScreen({ tab, ranking, live }: Props) {
  return (
    <>
      <section className={styles.hero}>
        <Image src="/mock/hall-of-fame/hero.jpg" alt="" fill priority sizes="100vw" className={styles.heroImage} />
        <span className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.heroLabels}>
            <span className={styles.heroBadge}>명예의 전당</span>
            <span className={styles.heroHighlight}>크리에이터들의 영원한 등불</span>
          </div>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              <TrophyMarkIcon className={styles.heroMark} />
              우리의 크리에이터를 빛나게 해주신 최고의 서포터들
            </h1>
            <p className={styles.heroDescription}>
              썸네이션 생태계를 함께 만들고, 크리에이터들의 도전에 힘을 보태주신 고마운 분들을 기억합니다. 매일 실시간 및 정기 후원 내역을
              집계하여 최고의 명예를 헌정합니다.
            </p>
          </div>
        </div>
      </section>

      <nav className={local.tabs} aria-label="명예의 전당">
        {HOF_TABS.map((t) => (
          <Link key={t.key} href={hofHref({ tab: t.key === "titles" ? undefined : t.key })} className={local.tab} aria-current={tab === t.key ? "page" : undefined}>
            {t.key === "titles" ? "🏅" : t.key === "leaderboard" ? "🏆" : "🔥"} {t.label}
          </Link>
        ))}
      </nav>

      {tab === "titles" && <TitleGallery />}
      {tab === "leaderboard" && ranking && <Leaderboard ranking={ranking} />}
      {tab === "live" && live && <LiveBoard live={live} />}

      <section className={styles.promo} aria-labelledby="hof-promo">
        <Image src="/mock/hall-of-fame/promo.jpg" alt="" fill sizes="100vw" className={styles.promoImage} />
        <div className={styles.promoInner}>
          <div className={styles.promoText}>
            <span className={styles.promoLabel}>서포터즈 혜택</span>
            <h2 id="hof-promo" className={styles.promoTitle}>
              내 최애 크리에이터의 전용 명예 배지를 획득해보세요!
            </h2>
            <p className={styles.promoDescription}>
              서포터즈 랭킹에 등재되면 프로필 전용 한정판 배지, 채팅 강조 하이라이트 및 비공개 오리지널 콘텐츠 사전 입장권을 지급해 드립니다.
            </p>
          </div>
          {/* 2026-10-04 결정: 후원할 크리에이터를 찾는 화면으로. */}
          <Button href="/creators" variant="light" size="lg" className={styles.promoCta}>
            나도 서포터 되기
          </Button>
        </div>
      </section>
    </>
  );
}

/** 칭호 갤러리 — our grade and global title ladders (names and thresholds are placeholders, TBD). */
function TitleGallery() {
  const titles = [...GLOBAL_TITLES].reverse();
  const grades = [...GRADES].reverse();
  const range = (min: number, next: number | undefined) => (next ? `${formatNumber(min)} ~ ${formatNumber(next)} FN` : `${formatNumber(min)} FN 이상`);
  return (
    <div className={local.panel}>
      <section className={local.gallery} aria-labelledby="hof-titles">
        <h2 id="hof-titles" className={local.galleryTitle}>
          글로벌 칭호
        </h2>
        <p className={local.caption}>누적 후원 FN으로 얻는 칭호예요. 칭호 이름과 기준은 확정 전 임시 값이에요.</p>
        <ul className={local.cards}>
          {titles.map((t, i) => (
            <li key={t.key} className={local.card} data-top={i === 0 || undefined}>
              <span className={local.medal} aria-hidden="true">
                🏅
              </span>
              <strong>{t.label}</strong>
              <span className={local.range}>{range(t.minFn, titles[i - 1]?.minFn)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className={local.gallery} aria-labelledby="hof-grades">
        <h2 id="hof-grades" className={local.galleryTitle}>
          후원자 등급
        </h2>
        <p className={local.caption}>최근 30일 후원 FN으로 정해지는 등급이에요. 기준은 확정 전 임시 값이에요.</p>
        <ul className={local.cards}>
          {grades.map((g, i) => (
            <li key={g.key} className={local.card} data-top={i === 0 || undefined}>
              <span className={local.medal} aria-hidden="true">
                💎
              </span>
              <strong>{g.label}</strong>
              <span className={local.range}>{range(g.minFn, grades[i - 1]?.minFn)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Leaderboard({ ranking }: { ranking: SupporterRanking }) {
  const podium = ranking.supporters.filter((s) => s.rank <= 3);
  const rest = ranking.supporters.filter((s) => s.rank > 3);
  const shown = ranking.supporters.length;
  const periodHref = (p: RankingPeriod) => hofHref({ tab: "leaderboard", period: p === DEFAULT_RANKING_PERIOD ? undefined : p });

  return (
    <>
      <section className={styles.section} aria-labelledby="hof-period">
        <h2 id="hof-period" className={styles.periodTitle}>
          리더보드
        </h2>
        <nav className={styles.periodTabs} aria-labelledby="hof-period">
          {(Object.keys(RANKING_PERIOD_LABEL) as RankingPeriod[]).map((p) => (
            <Link key={p} href={periodHref(p)} className={`${styles.periodTab} ${p === ranking.period ? styles.periodTabActive : ""}`} aria-current={p === ranking.period ? "page" : undefined}>
              {RANKING_PERIOD_LABEL[p]}
            </Link>
          ))}
          <span className={`${styles.periodTab} ${local.disabled}`} aria-disabled="true" title="준비 중인 기능입니다">
            과거 기록
          </span>
        </nav>
      </section>

      {ranking.supporters.length === 0 ? (
        <div className={styles.section}>
          <p className={styles.empty}>이 기간에는 아직 집계된 후원 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          <section className={styles.podiumSection} aria-label="1위부터 3위까지">
            <ol className={styles.podium}>
              {[2, 1, 3].map((rank) => {
                const supporter = podium.find((s) => s.rank === rank);
                return supporter ? <PodiumCard key={rank} supporter={supporter} /> : null;
              })}
            </ol>
          </section>
          {rest.length > 0 && (
            <section className={styles.rankingSection} aria-labelledby="hof-ranking">
              <h2 id="hof-ranking" className={styles.rankingTitle}>
                📈 서포터 랭킹 (4위 - {rest.at(-1)?.rank}위)
              </h2>
              <RankList supporters={rest} />
              {shown < ranking.total && (
                <Link href={hofHref({ tab: "leaderboard", period: ranking.period === DEFAULT_RANKING_PERIOD ? undefined : ranking.period, show: shown + LEADERBOARD_STEP })} className={local.more} scroll={false}>
                  더 보기 ({shown}/{ranking.total})
                </Link>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function LiveBoard({ live }: { live: LiveRanking }) {
  return (
    <section className={styles.rankingSection} aria-labelledby="hof-live">
      <h2 id="hof-live" className={styles.rankingTitle}>
        🔥 실시간 랭킹
      </h2>
      <nav className={styles.periodTabs} aria-label="집계 시간">
        {LIVE_WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={hofHref({ tab: "live", window: w.key === "30m" ? undefined : w.key })}
            className={`${styles.periodTab} ${w.key === live.window ? styles.periodTabActive : ""}`}
            aria-current={w.key === live.window ? "page" : undefined}
            scroll={false}
          >
            {w.label}
          </Link>
        ))}
      </nav>
      {live.supporters.length === 0 ? <p className={styles.empty}>이 시간 동안 들어온 후원이 없습니다.</p> : <RankList supporters={live.supporters} />}
    </section>
  );
}

function RankList({ supporters }: { supporters: RankedSupporter[] }) {
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
            <TierBadge tier={s.tier} />
            <span className={styles.amount}>
              <strong>{formatKrw(s.donationAmountKrw)}</strong>
              <span>후원 금액</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

const PODIUM_CLASS: Record<number, string> = { 1: styles.first, 2: styles.second, 3: styles.third };

function PodiumCard({ supporter }: { supporter: RankedSupporter }) {
  const { rank } = supporter;
  return (
    <li className={`${styles.podiumCard} ${PODIUM_CLASS[rank]}`}>
      <span className={styles.podiumLabel}>
        {rank === 1 && <TrophyMarkSmallIcon />}
        {rank}위 서포터
      </span>
      <span className={styles.podiumRing}>
        <Image src={supporter.avatarUrl} alt="" width={94} height={104} className={styles.podiumAvatar} />
      </span>
      <span className={styles.podiumText}>
        <strong className={styles.podiumName}>{supporter.nickname}</strong>
        <span className={styles.podiumAmount}>{formatKrw(supporter.donationAmountKrw)}</span>
      </span>
      <TierBadge tier={supporter.tier} />
    </li>
  );
}

function TierBadge({ tier }: { tier: SupporterTier }) {
  return <span className={`${styles.tier} ${TIER_CLASS[tier]}`}>{tier}</span>;
}
