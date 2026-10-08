import { PLATFORMS, type PlatformCreator, type PlatformKey } from "@/services/platformDonation/platformTypes";
import { CreatorRow, PlatformHeader, SearchForm } from "./parts";
import styles from "./platformDonation.module.css";

/** Figma 817:9146 (SOOP) · 817:8449 (FlexTV) — results and the empty state. */
export function PlatformSearchScreen({ platform, query, balance, results }: { platform: PlatformKey; query: string; balance: number; results: PlatformCreator[] }) {
  const p = PLATFORMS[platform];
  return (
    <div className={styles.content}>
      <PlatformHeader platform={platform} subtitle={`후원할 ${p.creatorWord}를 검색해보세요.`} balance={balance} />
      <SearchForm platform={platform} defaultValue={query} />
      <section className={styles.section} aria-label="검색 결과">
        <h2 className={styles.sectionTitle}>검색 결과</h2>
        {!query ? (
          <p className={styles.emptyCard}>닉네임 또는 ID를 입력해 검색해 주세요.</p>
        ) : results.length === 0 ? (
          <div className={styles.emptyCard}>
            <strong>검색 결과가 없습니다.</strong>
            <span>닉네임 또는 ID를 다시 확인해주세요.</span>
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
