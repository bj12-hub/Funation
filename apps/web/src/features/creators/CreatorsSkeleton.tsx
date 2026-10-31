import { getT } from "@/lib/i18n/server";
import styles from "./creators.module.css";
import skeleton from "./CreatorsSkeleton.module.css";

/** LOADING state for the creator directory. */
export async function CreatorsSkeleton() {
  const t = await getT();
  return (
    <div className={styles.page} aria-busy="true" aria-label={t("creators.loading")}>
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
