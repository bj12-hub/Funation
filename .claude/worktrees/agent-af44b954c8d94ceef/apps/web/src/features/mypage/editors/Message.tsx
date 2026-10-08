import styles from "./editors.module.css";

/** Inline result box used by the ID and password modals (Figma 747:304 error · 747:483 success). */
export function Message({ tone, text }: { tone: "error" | "success"; text: string }) {
  return (
    <p className={`${styles.message} ${tone === "error" ? styles.messageError : styles.messageSuccess}`} role={tone === "error" ? "alert" : "status"}>
      <span className={styles.messageGlyph} aria-hidden="true">
        {tone === "error" ? "!" : "✓"}
      </span>
      {text}
    </p>
  );
}
