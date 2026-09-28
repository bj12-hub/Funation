import Image from "next/image";
import Link from "next/link";
import { TrophyMarkIcon, TrophyMarkSmallIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import {
  DEFAULT_RANKING_PERIOD,
  RANKING_PERIOD_LABEL,
  type RankedSupporter,
  type RankingPeriod,
  type SupporterRanking,
  type SupporterTier
} from "@/services/hallOfFame/supporterRanking";
import styles from "./hallOfFame.module.css";

const TIER_CLASS: Record<SupporterTier, string> = {
  DIAMOND: styles.tierDiamond,
  GOLD: styles.tierGold,
  SILVER: styles.tierSilver,
  BRONZE: styles.tierBronze
};

const formatKrw = (amount: number) => `₩${formatNumber(amount)}`;

const periodHref = (p: RankingPeriod) => (p === DEFAULT_RANKING_PERIOD ? "/hall-of-fame" : `/hall-of-fame?period=${p}`);

/**
 * Hall of fame (supporter ranking).
 * Figma: funation-hall-of-fame 3:637 (route `/hall-of-fame`, all roles incl. guests)
 */
export function HallOfFameScreen({ ranking }: { ranking: SupporterRanking }) {
  const podium = ranking.supporters.filter((s) => s.rank <= 3);
  const rest = ranking.supporters.filter((s) => s.rank > 3);
  const lastRank = rest.at(-1)?.rank;

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
              Funation 생태계를 함께 만들고, 크리에이터들의 도전에 힘을 보태주신 고마운 분들을 기억합니다. 매일 실시간 및 정기 후원 내역을
              집계하여 최고의 명예를 헌정합니다.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="hof-period">
        <h2 id="hof-period" className={styles.periodTitle}>
          기간별 랭킹 보기
        </h2>
        <nav className={styles.periodTabs} aria-labelledby="hof-period">
          {(Object.keys(RANKING_PERIOD_LABEL) as RankingPeriod[]).map((p) => (
            <Link
              key={p}
              href={periodHref(p)}
              className={`${styles.periodTab} ${p === ranking.period ? styles.periodTabActive : ""}`}
              aria-current={p === ranking.period ? "page" : undefined}
            >
              {RANKING_PERIOD_LABEL[p]}
            </Link>
          ))}
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
                📈 실시간 서포터 랭킹 (4위 - {lastRank}위)
              </h2>
              <ol className={styles.rankingList}>
                {rest.map((s) => (
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
            </section>
          )}
        </>
      )}

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
          {/* TODO: destination not defined in Figma yet. */}
          <Button variant="light" size="lg" className={styles.promoCta} aria-disabled="true" title="준비 중인 기능입니다">
            나도 서포터 되기
          </Button>
        </div>
      </section>
    </>
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
