import { Fragment } from "react";
import { CreditCardIcon } from "@/components/icons";
import styles from "./settlement.module.css";

export const SETTLEMENT_STEPS = ["정산 등록", "정산 신청", "정산 승인"] as const;

/**
 * Figma 429:54 gradient stepper banner. `current` is the active step (0-based): dots up to it are
 * filled, and the track is solid up to the segment leaving the active step (as drawn in 429:59).
 */
export function SettlementStepper({ current }: { current: number }) {
  return (
    <div className={styles.banner}>
      <div className={styles.stepper}>
        <div className={styles.track} aria-hidden="true">
          {SETTLEMENT_STEPS.map((label, i) => (
            <Fragment key={label}>
              {i > 0 && <span className={styles.trackLine} data-on={i - 1 <= current || undefined} />}
              <span className={styles.trackDot} data-state={i < current ? "done" : i === current ? "current" : "todo"} />
            </Fragment>
          ))}
        </div>
        <ol className={styles.stepLabels} aria-label="정산 진행 단계">
          {SETTLEMENT_STEPS.map((label, i) => (
            <li key={label} data-on={i <= current || undefined} aria-current={i === current ? "step" : undefined}>
              {label}
            </li>
          ))}
        </ol>
      </div>
      <span className={styles.bannerIcon} aria-hidden="true">
        <CreditCardIcon />
      </span>
    </div>
  );
}
