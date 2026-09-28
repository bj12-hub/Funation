import type { ReactNode } from "react";
import styles from "./AuthCard.module.css";

/**
 * Centered card shared by auth screens (login, lockout, password reset, sign up).
 * Figma: auth-card 13:28 / 인증 카드 718:231
 */
type AuthCardProps = {
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <section className={styles.card} aria-labelledby="auth-card-title">
      <header className={styles.header}>
        <span className={styles.brand}>Funation</span>
        <div className={styles.titleGroup}>
          <h1 id="auth-card-title" className={styles.title}>
            {title}
          </h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
