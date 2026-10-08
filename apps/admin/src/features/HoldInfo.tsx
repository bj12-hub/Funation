import type { AdminHold } from "@/types/adminApi";
import styles from "./admin.module.css";

const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

/** The "보류" chip in a card head, next to the status chip (the status itself does not change while held). */
export function HoldChip({ hold }: { hold: AdminHold | null }) {
  return hold ? <span className={styles.chipInfo}>보류</span> : null;
}

/**
 * A held card's memo and who put it on 보류 (2026-10-08 결정). `stops`: what waits for 보류 해제, with its particle —
 * "승인 · 반려를", "지급 완료를", "승인 · 거절을".
 */
export function HoldInfo({ hold, stops }: { hold: AdminHold; stops: string }) {
  return (
    <>
      <p className={styles.quote}>보류 메모: {hold.note}</p>
      <p className={styles.muted}>
        보류 {when(hold.at)} · {hold.by} · 보류를 해제할 때까지 {stops} 할 수 없어요.
      </p>
    </>
  );
}
