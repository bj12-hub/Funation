import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import styles from "./TextField.module.css";

/**
 * Text input used on auth screens.
 * Figma: default 13:35 · error 718:148 (2px #f87171 border + message)
 */
type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string | null;
  trailing?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { error, trailing, className, id, ...inputProps },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className={styles.root}>
      <div className={`${styles.field} ${error ? styles.fieldError : ""} ${className ?? ""}`}>
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {trailing}
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          <span className={styles.errorDot} aria-hidden="true">
            ●
          </span>
          {error}
        </p>
      )}
    </div>
  );
});
