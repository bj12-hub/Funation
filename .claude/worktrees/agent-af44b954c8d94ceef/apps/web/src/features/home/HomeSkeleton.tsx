import shared from "./home.module.css";
import styles from "./HomeSkeleton.module.css";

/** LOADING state for the home screen — mirrors the section layout of 727:2742. */
export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="홈 화면을 불러오는 중">
      <div className={styles.hero} />
      <div className={shared.section}>
        <div className={styles.heading} />
        <div className={shared.trendingGrid}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={shared.card}>
              <div className={`${shared.thumb} ${styles.block}`} />
              <div className={styles.line} />
              <div className={`${styles.line} ${styles.lineShort}`} />
            </div>
          ))}
        </div>
      </div>
      <div className={shared.section}>
        <div className={styles.heading} />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={styles.row} />
        ))}
      </div>
    </div>
  );
}
