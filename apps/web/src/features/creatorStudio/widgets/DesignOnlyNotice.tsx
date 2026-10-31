import Link from "next/link";
import styles from "./widgets.module.css";

/**
 * With FLEXTV (phase 8) a 위젯 popup sets only the overlay's look: where the rules are set instead (the form's
 * `live.designOnly`).
 */
export function DesignOnlyNotice({ rules }: { rules: string }) {
  return (
    <p className={styles.notice}>
      ※ 여기서는 방송 화면에 보이는 모양만 정해요. {rules}은(는){" "}
      <Link href="/creator/donation-types" className={styles.linkButton}>
        후원 종류 설정
      </Link>
      에서 바꿔요.
    </p>
  );
}
