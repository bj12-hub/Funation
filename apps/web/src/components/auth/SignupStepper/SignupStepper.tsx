import { CheckIcon } from "@/components/icons";
import styles from "./SignupStepper.module.css";

/** Figma: step-indicator 280:75 · 722:558 · 723:203 */
const STEPS = ["약관 동의", "번호 인증", "계정 설정"] as const;

type SignupStepperProps = {
  /** 1-based current step. Pass `steps.length + 1` when every step is complete. */
  current: number;
  /** Step labels; the FLEXTV sign-up has no 번호 인증 step (docs/development/flextv-backend.md). */
  steps?: readonly string[];
};

export function SignupStepper({ current, steps = STEPS }: SignupStepperProps) {
  const total = steps.length;
  const shown = Math.min(current, total);

  return (
    <div className={styles.root} aria-label={`회원가입 ${shown}/${total} 단계`}>
      <p className={styles.count}>
        {shown} / {total}
      </p>
      <ol className={styles.dots}>
        {steps.map((label, index) => {
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
        {steps.map((label, index) => (
          <li key={label} className={index + 1 === shown ? styles.labelActive : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
