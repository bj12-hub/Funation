import styles from "./PageLoading.module.css";

/** Generic LOADING state for route `loading.tsx` files without a dedicated skeleton. */
export function PageLoading({ label }: { label: string }) {
  return (
    <div className={styles.root} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
