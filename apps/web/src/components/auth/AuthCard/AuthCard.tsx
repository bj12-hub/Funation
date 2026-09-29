import type { ReactNode } from "react";
import styles from "./AuthCard.module.css";

/**
 * Centered card shared by auth screens.
 * Figma: login 13:28 (460px, gap 28) · signup 722:556 (480px, gap 24)
 */
type AuthCardProps = {
  title?: string;
  description?: ReactNode;
  /** Rendered between the brand and the title, e.g. the signup stepper. */
  progress?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
};

export function AuthCard({ title, description, progress, size = "md", children }: AuthCardProps) {
  return (
    <section className={`${styles.card} ${styles[size]}`} aria-labelledby={title ? "auth-card-title" : undefined}>
      <header className={styles.header}>
        <span className={styles.brand}>Somnation</span>
        {progress}
        {title && (
          <div className={styles.titleGroup}>
            <h1 id="auth-card-title" className={styles.title}>
              {title}
            </h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}
