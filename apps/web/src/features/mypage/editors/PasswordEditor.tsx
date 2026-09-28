"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { isValidNewPassword } from "@/lib/validation";
import { changePassword } from "@/services/account/profileActions";
import { Message } from "./Message";
import { GENERIC_ERROR } from "./shared";
import styles from "./editors.module.css";

/**
 * Password change. Figma: base 743:2107 · wrong current 747:526 · rule 747:579 · mismatch 747:632
 * · reused 747:685 · success 747:738 (the member signs in again afterwards).
 */

type Field = "current" | "next" | "confirm";
type ErrorKind = "WRONG_CURRENT" | "INVALID" | "MISMATCH" | "REUSED" | "ERROR";

const ERRORS: Record<ErrorKind, { field: Field | null; text: string }> = {
  WRONG_CURRENT: { field: "current", text: "현재 비밀번호가 일치하지 않습니다. 다시 확인해 주세요." },
  INVALID: { field: "next", text: "영문, 숫자, 특수문자를 모두 포함해 8~20자로 입력해 주세요." },
  MISMATCH: { field: "confirm", text: "새 비밀번호가 서로 일치하지 않습니다." },
  REUSED: { field: "next", text: "기존 비밀번호와 같거나 최근 사용한 비밀번호는 사용할 수 없습니다." },
  ERROR: { field: null, text: GENERIC_ERROR }
};

const FIELDS: { key: Field; label: string; autoComplete: string }[] = [
  { key: "current", label: "현재 비밀번호", autoComplete: "current-password" },
  { key: "next", label: "새 비밀번호", autoComplete: "new-password" },
  { key: "confirm", label: "새 비밀번호 확인", autoComplete: "new-password" }
];

const EMPTY: Record<Field, string> = { current: "", next: "", confirm: "" };

export function PasswordEditor({ triggerClassName }: { triggerClassName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);

  // After a successful change the server has ended the session.
  const goToLogin = () => router.push("/login?next=/mypage");

  async function submit() {
    if (!values.current) return setError("WRONG_CURRENT");
    if (!isValidNewPassword(values.next)) return setError("INVALID");
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
        비밀번호 변경
      </button>
      <Modal
        open={open}
        onClose={changed ? goToLogin : () => setOpen(false)}
        title="비밀번호 변경"
        description="안전한 계정 이용을 위해 비밀번호를 변경합니다."
        footer={
          changed ? (
            <>
              <button type="button" className={styles.secondary} onClick={goToLogin}>
                닫기
              </button>
              <button type="button" className={styles.primary} onClick={goToLogin}>
                다시 로그인
              </button>
            </>
          ) : (
            <>
              <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
                취소
              </button>
              <button type="submit" form="password-change-form" className={styles.primary} disabled={busy} aria-busy={busy || undefined}>
                비밀번호 변경
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
                {f.label}
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
                  disabled={changed}
                  aria-invalid={fieldInError === f.key || undefined}
                  aria-describedby="password-message"
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [f.key]: e.target.value }));
                    setError(null);
                  }}
                />
                {fieldInError === f.key && <span className={styles.badge}>확인 필요</span>}
              </div>
            </div>
          ))}
          <div id="password-message" aria-live="polite" className={styles.content}>
            {error && <Message tone="error" text={ERRORS[error].text} />}
            {changed && <Message tone="success" text="비밀번호가 안전하게 변경되었습니다. 보안을 위해 다시 로그인해 주세요." />}
            {!changed && <p className={styles.footnote}>영문, 숫자, 특수문자를 포함해 8자 이상 입력해 주세요.</p>}
          </div>
        </form>
      </Modal>
    </>
  );
}
