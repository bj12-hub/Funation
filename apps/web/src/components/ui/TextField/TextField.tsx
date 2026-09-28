import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./TextField.module.css";

/**
 * Text input used on auth screens.
 * Figma: default 13:35 · error 718:148 (2px #f87171 border + message)
 */
type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  /** Helper text shown under the field (and under the error, if any). Figma 722:894 */
  hint?: string;
  trailing?: ReactNode;
  /** Element placed to the right of the input box, e.g. "중복 확인". Figma 722:882 */
  action?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, trailing, action, className, id, ...inputProps },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  const box = (
    <div className={`${styles.field} ${error ? styles.fieldError : ""} ${className ?? ""}`}>
      <input
        ref={ref}
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {trailing}
    </div>
  );

  return (
    <div className={styles.root}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      {action ? (
        <div className={styles.row}>
          {box}
          {action}
        </div>
      ) : (
        box
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          <span className={styles.errorDot} aria-hidden="true">
            ●
          </span>
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
});
