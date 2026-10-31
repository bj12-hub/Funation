import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { PLATFORMS, type PlatformHome } from "@/services/platformDonation/platformTypes";
import { CreatorRow, PlatformHeader, SearchForm } from "./parts";
import { PLATFORM_WORDS } from "./words";
import styles from "./platformDonation.module.css";

/**
 * Figma 817:9017 (SOOP) · 817:8317 (FlexTV) — search, 최근 후원, 인기 스트리머/호스트. The product panel
 * shown on the landing frame lives on the detail step (817:9242 · 817:8597), where the target is known.
 */
export async function PlatformHomeScreen({ home }: { home: PlatformHome }) {
  const t = await getT();
  const p = PLATFORMS[home.platform];
  const words = PLATFORM_WORDS[home.platform];
  const whos = t(words.whos);
  const sections = [
    { title: t("platformDonation.recentTitle", { who: whos }), items: home.recent, empty: t("platformDonation.recentEmpty", { who: whos }) },
    { title: t("platformDonation.popularTitle", { who: whos }), items: home.popular, empty: t("platformDonation.popularEmpty", { who: whos }) }
  ];
  return (
    <div className={styles.content}>
      <PlatformHeader platform={home.platform} subtitle={t(words.tagline)} balance={home.balance} />
      <SearchForm platform={home.platform} />
      <Link href={`/donation/history?tab=${p.slug}`} className={styles.historyLink}>
        {t("platformDonation.historyLink", { platform: p.name })}
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
