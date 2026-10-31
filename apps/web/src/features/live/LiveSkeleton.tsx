import { getT } from "@/lib/i18n/server";
import styles from "./live.module.css";
import skeleton from "./LiveSkeleton.module.css";

/** LOADING state for the live pages. */
export async function LiveSkeleton() {
  const t = await getT();
  return (
    <div className={styles.content} aria-busy="true" aria-label={t("live.loading")}>
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
