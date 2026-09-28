import styles from "./creators.module.css";
import skeleton from "./CreatorsSkeleton.module.css";

/** LOADING state for the creator directory. */
export function CreatorsSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="크리에이터 목록을 불러오는 중">
      <div className={styles.hero}>
        <div className={skeleton.title} />
        <div className={skeleton.bar} />
      </div>
      <div className={styles.results}>
        <div className={styles.grid}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={skeleton.card} />
          ))}
        </div>
      </div>
    </div>
  );
}
