import Link from "next/link";
import styles from "../crew/crew.module.css";

/** 시청자 참여 게임 sub-navigation (code-first): a page per game. */
export function PlayTabs({ active }: { active: "marble" | "rumble" }) {
  return (
    <nav className={styles.tabs} aria-label="시청자 참여 게임">
      <Link href="/creator/widgets/play" className={styles.tab} aria-current={active === "marble" ? "page" : undefined}>
        🔮 마블 룰렛
      </Link>
      <Link href="/creator/widgets/play/rumble" className={styles.tab} aria-current={active === "rumble" ? "page" : undefined}>
        ⚔️ 로얄 럼블
      </Link>
    </nav>
  );
}
