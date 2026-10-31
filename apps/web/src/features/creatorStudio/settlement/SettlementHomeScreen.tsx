"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { SettlementChecklist as Checklist } from "@/services/creator/settlementTypes";
import { SettlementChecklist } from "./SettlementChecklist";
import { SettlementStartCards } from "./SettlementStartCards";
import { SettlementStepper } from "./SettlementStepper";
import styles from "./settlement.module.css";

type Props = { registered: boolean; justRegistered: boolean; checklist: Checklist; minFn: number | null; identityGate: boolean };

/**
 * Figma 429:4 settlement-management — 정산설정 home (route `/creator/settlement`) + code-first checklist.
 * `identityGate` (`?gate=identity`, from the apply page) opens the 본인인증 notice on arrival. `minFn`: the minimum the
 * server enforces for 정산 신청, stated on its card. A client component so its text follows the language (useI18n) while
 * the page can still be rendered on its own (Korean outside a provider).
 */
export function SettlementHomeScreen({ registered, justRegistered, checklist, minFn, identityGate }: Props) {
  const { t } = useI18n();
  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>{t("studioSettlement.overviewTitle")}</h1>
      {/* 정산 승인 is per request (정산 관리), so the banner only tracks registration here. */}
      <SettlementStepper current={registered ? 1 : 0} />

      <SettlementChecklist checklist={checklist} />

      <section className={styles.startSection} aria-labelledby="settle-start">
        <h2 id="settle-start" className={styles.startTitle}>
          {t("studioSettlement.startTitle")}
        </h2>
        <SettlementStartCards
          registered={registered}
          identityVerified={checklist.identityVerified}
          justRegistered={justRegistered}
          minFn={minFn}
          identityGate={identityGate}
        />
      </section>
    </div>
  );
}
