"use client";

import { ToggleCheckIcon } from "@/components/icons";
import styles from "./Toggle.module.css";

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** PROCESSING: blocks input while a change is being saved. */
  busy?: boolean;
  disabled?: boolean;
};

/** On/off switch. Figma: toggle-track 735:4295 (on) · 735:4307 (off). */
export function Toggle({ checked, onChange, label, busy = false, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={`${styles.track} ${checked ? styles.on : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob}>{checked && <ToggleCheckIcon />}</span>
    </button>
  );
}
