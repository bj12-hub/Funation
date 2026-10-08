import styles from "./admin.module.css";

/**
 * The 탈퇴 mark after a withdrawn member's original nickname (2026-10-08 결정: every console screen, before and after a
 * 재가입). Same chip as the 회원 관리 status "탈퇴". Nothing for an active member.
 */
export function WithdrawnBadge({ withdrawn }: { withdrawn: boolean }) {
  if (!withdrawn) return null;
  return (
    <>
      {" "}
      <span className={styles.chipNeutral}>탈퇴</span>
    </>
  );
}
