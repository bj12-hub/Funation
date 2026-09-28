import styles from "./live.module.css";
import skeleton from "./LiveSkeleton.module.css";

/** LOADING state for the live pages. */
export function LiveSkeleton() {
  return (
    <div className={styles.content} aria-busy="true" aria-label="라이브 목록을 불러오는 중">
      <div className={skeleton.title} />
      <div className={skeleton.bar} />
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={skeleton.card}>
            <div className={skeleton.thumb} />
            <div className={skeleton.line} />
            <div className={`${skeleton.line} ${skeleton.short}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
