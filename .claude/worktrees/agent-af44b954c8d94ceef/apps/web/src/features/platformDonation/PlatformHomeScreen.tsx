import Link from "next/link";
import { PLATFORMS, type PlatformHome } from "@/services/platformDonation/platformTypes";
import { CreatorRow, PlatformHeader, SearchForm } from "./parts";
import styles from "./platformDonation.module.css";

/**
 * Figma 817:9017 (SOOP) · 817:8317 (FlexTV) — search, 최근 후원, 인기 스트리머/호스트. The product panel
 * shown on the landing frame lives on the detail step (817:9242 · 817:8597), where the target is known.
 */
export function PlatformHomeScreen({ home }: { home: PlatformHome }) {
  const p = PLATFORMS[home.platform];
  const sections = [
    { title: `최근 후원 ${p.creatorWord}`, items: home.recent, empty: `최근 후원한 ${p.creatorWord}가 없습니다.` },
    { title: `인기 ${p.creatorWord}`, items: home.popular, empty: `인기 ${p.creatorWord} 정보가 없습니다.` }
  ];
  return (
    <div className={styles.content}>
      <PlatformHeader platform={home.platform} subtitle={p.tagline} balance={home.balance} />
      <SearchForm platform={home.platform} />
      <Link href={`/donation/history?tab=${p.slug}`} className={styles.historyLink}>
        {p.name} 후원 내역 보기 ›
      </Link>
      {sections.map((s) => (
        <section key={s.title} className={styles.section} aria-label={s.title}>
          <h2 className={styles.sectionTitle}>{s.title}</h2>
          {s.items.length === 0 ? (
            <p className={styles.emptyCard}>{s.empty}</p>
          ) : (
            <ul className={styles.list}>
              {s.items.map((c) => (
                <CreatorRow key={c.id} platform={home.platform} creator={c} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
