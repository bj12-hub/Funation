import Link from "next/link";
import styles from "./crew.module.css";

/** 크루 관리 sub-navigation (code-first). */
export function CrewTabs({ active }: { active: "members" | "broadcast" }) {
  return (
    <nav className={styles.tabs} aria-label="크루 메뉴">
      <Link href="/creator/crew" className={styles.tab} aria-current={active === "members" ? "page" : undefined}>
        멤버
      </Link>
      <Link href="/creator/crew/broadcast" className={styles.tab} aria-current={active === "broadcast" ? "page" : undefined}>
        방송 운영
      </Link>
    </nav>
  );
}
