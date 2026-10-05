import styles from "@/features/admin.module.css";

/** LOADING state inside the console (the menu stays usable while a page asks the site API). */
export default function ConsoleLoading() {
  return (
    <div className={styles.content}>
      <section className={styles.card} role="status" aria-live="polite">
        <p className={styles.muted}>불러오는 중…</p>
      </section>
    </div>
  );
}
