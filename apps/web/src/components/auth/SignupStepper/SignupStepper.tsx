"use client";

import { CheckIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import styles from "./SignupStepper.module.css";

/** Figma: step-indicator 280:75 · 722:558 · 723:203 */
const STEPS: readonly MessageKey[] = ["auth.stepperTerms", "auth.stepperPhone", "auth.stepperAccount"];

type SignupStepperProps = {
  /** 1-based current step. Pass 4 when every step is complete. */
  current: 1 | 2 | 3 | 4;
};

export function SignupStepper({ current }: SignupStepperProps) {
  const { t } = useI18n();
  const shown = Math.min(current, 3);
  const labels = STEPS.map((key) => t(key));

  return (
    <div className={styles.root} aria-label={t("auth.stepperAria", { step: shown })}>
      <p className={styles.count}>{shown} / 3</p>
      <ol className={styles.dots}>
        {labels.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li key={label} className={styles.item}>
              {index > 0 && <span className={`${styles.connector} ${step <= current ? styles.connectorDone : ""}`} />}
              <span
                className={`${styles.dot} ${done || active ? styles.dotFilled : ""}`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <CheckIcon /> : step}
              </span>
            </li>
          );
        })}
      </ol>
      <ol className={styles.labels} aria-hidden="true">
        {labels.map((label, index) => (
          <li key={label} className={index + 1 === shown ? styles.labelActive : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
