import { getT } from "@/lib/i18n/server";
import type { PlatformCreator, PlatformKey } from "@/services/platformDonation/platformTypes";
import { CreatorRow, PlatformHeader, SearchForm } from "./parts";
import { PLATFORM_WORDS } from "./words";
import styles from "./platformDonation.module.css";

/** Figma 817:9146 (SOOP) · 817:8449 (FlexTV) — results and the empty state. */
export async function PlatformSearchScreen({ platform, query, balance, results }: { platform: PlatformKey; query: string; balance: number; results: PlatformCreator[] }) {
  const t = await getT();
  return (
    <div className={styles.content}>
      <PlatformHeader platform={platform} subtitle={t("platformDonation.searchSubtitle", { who: t(PLATFORM_WORDS[platform].who) })} balance={balance} />
      <SearchForm platform={platform} defaultValue={query} />
      <section className={styles.section} aria-label={t("platformDonation.results")}>
        <h2 className={styles.sectionTitle}>{t("platformDonation.results")}</h2>
        {!query ? (
          <p className={styles.emptyCard}>{t("platformDonation.searchPrompt")}</p>
        ) : results.length === 0 ? (
          <div className={styles.emptyCard}>
            <strong>{t("platformDonation.noResults")}</strong>
            <span>{t("platformDonation.checkId")}</span>
          </div>
        ) : (
          <ul className={styles.list}>
            {results.map((c) => (
              <CreatorRow key={c.id} platform={platform} creator={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
