import { SettlementStartCards } from "./SettlementStartCards";
import { SettlementStepper } from "./SettlementStepper";
import styles from "./settlement.module.css";

/** Figma 429:4 settlement-management — 정산설정 home (route `/creator/settlement`). */
export function SettlementHomeScreen({ registered, justRegistered }: { registered: boolean; justRegistered: boolean }) {
  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>Funation 정산 현황</h1>
      {/* 정산 승인 is per request (정산 관리), so the banner only tracks registration here. */}
      <SettlementStepper current={registered ? 1 : 0} />

      <section className={styles.startSection} aria-labelledby="settle-start">
        <h2 id="settle-start" className={styles.startTitle}>
          정산을 시작할까요?
        </h2>
        <SettlementStartCards registered={registered} justRegistered={justRegistered} />
      </section>
    </div>
  );
}
