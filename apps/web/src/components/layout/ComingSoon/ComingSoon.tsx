import { Button } from "@/components/ui/Button";
import styles from "./ComingSoon.module.css";

/**
 * Temporary page body for routes whose Figma screens are not implemented yet.
 * Keeps every header/footer link working while screens are built one by one.
 */
type ComingSoonProps = {
  title: string;
  description?: string;
};

export function ComingSoon({ title, description = "더 나은 모습으로 곧 찾아올게요." }: ComingSoonProps) {
  return (
    <section className={styles.root}>
      <span className={styles.badge}>준비 중</span>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      <Button href="/" variant="secondary">
        홈으로 가기
      </Button>
    </section>
  );
}
