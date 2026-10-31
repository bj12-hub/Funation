"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { isValidPassword } from "@/lib/validation";
import { changePassword } from "@/services/account/profileActions";
import { Message } from "./Message";
import styles from "./editors.module.css";

/**
 * Password change. Figma: base 743:2107 · wrong current 747:526 · rule 747:579 · mismatch 747:632
 * · reused 747:685 · success 747:738 (the member signs in again afterwards).
 */

type Field = "current" | "next" | "confirm";
type ErrorKind = "WRONG_CURRENT" | "INVALID" | "MISMATCH" | "REUSED" | "LOCKED" | "ERROR";

const ERRORS: Record<ErrorKind, { field: Field | null; text: MessageKey }> = {
  WRONG_CURRENT: { field: "current", text: "myEdit.pwWrongCurrent" },
  // Code-first (no Figma frame): the same 5-failure lock as the login (718:213); the server has ended the session.
  LOCKED: { field: "current", text: "my.passwordLocked" },
  INVALID: { field: "next", text: "myEdit.pwInvalid" },
  MISMATCH: { field: "confirm", text: "myEdit.pwMismatch" },
  REUSED: { field: "next", text: "myEdit.pwReused" },
  ERROR: { field: null, text: "my.genericError" }
};

const FIELDS: { key: Field; label: MessageKey; autoComplete: string }[] = [
  { key: "current", label: "myEdit.pwCurrent", autoComplete: "current-password" },
  { key: "next", label: "myEdit.pwNew", autoComplete: "new-password" },
  { key: "confirm", label: "myEdit.pwConfirm", autoComplete: "new-password" }
];

const EMPTY: Record<Field, string> = { current: "", next: "", confirm: "" };

export function PasswordEditor({ triggerClassName }: { triggerClassName: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);

  // After a successful change the server has ended the session.
  const goToLogin = () => router.push("/login?next=/mypage");
  // Locked after too many wrong current passwords: the session has ended and only a reset unlocks the account.
  const locked = error === "LOCKED";
  const goToReset = () => router.push("/password-reset");

  async function submit() {
    if (!values.current) return setError("WRONG_CURRENT");
    if (!isValidPassword(values.next)) return setError("INVALID");
    if (values.next !== values.confirm) return setError("MISMATCH");
    setBusy(true);
    try {
      const result = await changePassword(values);
      if (result.status === "UNAUTHORIZED") return goToLogin();
      if (result.status === "CHANGED") {
        setChanged(true);
        setValues(EMPTY);
        return;
      }
      setError(result.status);
    } catch {
      setError("ERROR");
    } finally {
      setBusy(false);
    }
  }

  const fieldInError = error ? ERRORS[error].field : null;

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setValues(EMPTY);
          setError(null);
          setChanged(false);
          setOpen(true);
        }}
      >
        {t("myEdit.pwChange")}
      </button>
      <Modal
        open={open}
        onClose={changed ? goToLogin : locked ? goToReset : () => setOpen(false)}
        title={t("myEdit.pwChange")}
        description={t("myEdit.pwDesc")}
        footer={
          changed ? (
            <>
              <button type="button" className={styles.secondary} onClick={goToLogin}>
                {t("my.close")}
              </button>
              <button type="button" className={styles.primary} onClick={goToLogin}>
                {t("myEdit.pwRelogin")}
              </button>
            </>
          ) : locked ? (
            <>
              <button type="button" className={styles.secondary} onClick={goToReset}>
                {t("my.close")}
              </button>
              <button type="button" className={styles.primary} onClick={goToReset}>
                {t("myEdit.pwReset")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
                {t("my.cancel")}
              </button>
              <button type="submit" form="password-change-form" className={styles.primary} disabled={busy} aria-busy={busy || undefined}>
                {t("myEdit.pwChange")}
              </button>
            </>
          )
        }
      >
        <form
          id="password-change-form"
          className={styles.content}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {FIELDS.map((f) => (
            <div key={f.key} className={styles.field}>
              <label htmlFor={`password-${f.key}`} className={styles.label}>
                {t(f.label)}
              </label>
              <div className={`${styles.inputBox} ${fieldInError === f.key ? styles.inputError : ""}`}>
                <input
                  id={`password-${f.key}`}
                  type="password"
                  className={styles.input}
                  placeholder="••••••••••"
                  autoComplete={f.autoComplete}
                  maxLength={f.key === "current" ? 64 : 20}
                  value={values[f.key]}
                  disabled={changed || locked}
                  aria-invalid={fieldInError === f.key || undefined}
                  aria-describedby="password-message"
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [f.key]: e.target.value }));
                    setError(null);
                  }}
                />
                {fieldInError === f.key && <span className={styles.badge}>{t("my.needsCheck")}</span>}
              </div>
            </div>
          ))}
          <div id="password-message" aria-live="polite" className={styles.content}>
            {error && <Message tone="error" text={t(ERRORS[error].text)} />}
            {changed && <Message tone="success" text={t("myEdit.pwChanged")} />}
            {!changed && <p className={styles.footnote}>{t("myEdit.pwRule")}</p>}
          </div>
        </form>
      </Modal>
    </>
  );
}
