"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { isValidFunationId } from "@/lib/validation";
import { changeFunationId } from "@/services/account/profileActions";
import { Message } from "./Message";
import { GENERIC_ERROR, formatKoreanDate } from "./shared";
import styles from "./editors.module.css";

/**
 * Funation ID change. Figma: base 743:2063 · invalid 747:304 · duplicate 747:349 · forbidden 747:394
 * · 30-day limit 747:439 · success 747:483
 *
 * Figma conflict: the base placeholder reads "8자 이상, 영문/숫자/특수문자 포함" while the error copy
 * says "영문 소문자와 숫자만 5~20자". The error copy is used as the rule (flagged in the PR).
 */

type State =
  | { kind: "IDLE" }
  | { kind: "INVALID" | "DUPLICATE" | "FORBIDDEN" | "ERROR" }
  | { kind: "LIMITED"; availableFrom: string }
  | { kind: "CHANGED"; value: string };

const ERRORS: Record<"INVALID" | "DUPLICATE" | "FORBIDDEN" | "ERROR", string> = {
  INVALID: "영문 소문자와 숫자만 사용해 5~20자로 입력해 주세요.",
  DUPLICATE: "이미 사용 중인 ID입니다. 다른 ID를 입력해 주세요.",
  FORBIDDEN: "사용할 수 없는 표현이 포함되어 있습니다.",
  ERROR: GENERIC_ERROR
};

const NOTICE = "ID는 30일에 한 번 변경할 수 있으며 프로필 주소도 함께 변경됩니다.";

export function FunationIdEditor({ triggerClassName }: { triggerClassName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ kind: "IDLE" });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isValidFunationId(value)) return setState({ kind: "INVALID" });
    setBusy(true);
    try {
      const result = await changeFunationId(value);
      if (result.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (result.status === "CHANGED") {
        setState({ kind: "CHANGED", value: result.value });
        router.refresh();
        return;
      }
      setState(result.status === "LIMITED" ? { kind: "LIMITED", availableFrom: result.availableFrom } : { kind: result.status });
    } catch {
      setState({ kind: "ERROR" });
    } finally {
      setBusy(false);
    }
  }

  const changed = state.kind === "CHANGED";
  const limited = state.kind === "LIMITED";
  const error = state.kind in ERRORS ? ERRORS[state.kind as keyof typeof ERRORS] : null;
  const shownValue = changed ? state.value : value;

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setValue("");
          setState({ kind: "IDLE" });
          setOpen(true);
        }}
      >
        수정
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="썸네이션 ID 수정"
        description="나만의 썸네이션 ID를 설정해 주세요."
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {changed ? "닫기" : "취소"}
            </button>
            {changed ? (
              <button type="button" className={styles.primary} onClick={() => setOpen(false)}>
                확인
              </button>
            ) : (
              <button type="button" className={styles.primary} onClick={submit} disabled={busy || limited} aria-busy={busy || undefined}>
                ID 변경
              </button>
            )}
          </>
        }
      >
        <div className={styles.content}>
          <div className={styles.field}>
            <label htmlFor="funation-id-input" className={styles.label}>
              썸네이션 ID
            </label>
            <div className={`${styles.inputBox} ${error ? styles.inputError : ""}`}>
              <span className={styles.prefix} aria-hidden="true">
                @
              </span>
              <input
                id="funation-id-input"
                className={styles.input}
                placeholder="영문 소문자, 숫자 5~20자"
                maxLength={20}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                value={shownValue}
                disabled={changed || limited}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby="funation-id-message"
                onChange={(e) => {
                  setValue(e.target.value.trim());
                  setState({ kind: "IDLE" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              {error && <span className={styles.badge}>확인 필요</span>}
            </div>
          </div>

          <div id="funation-id-message" aria-live="polite" className={styles.content}>
            {error && <Message tone="error" text={error} />}
            {limited && (
              <Message tone="error" text={`최근 ID를 변경하여 지금은 수정할 수 없습니다. ${formatKoreanDate(state.availableFrom)}부터 변경할 수 있어요.`} />
            )}
            {changed && <Message tone="success" text={`썸네이션 ID가 @${state.value}로 변경되었습니다.`} />}
            {state.kind === "IDLE" && (
              <p className={`${styles.message} ${styles.messageNotice}`}>
                <span className={styles.messageGlyph} aria-hidden="true">
                  ⓘ
                </span>
                {NOTICE}
              </p>
            )}
            {(error || limited) && <p className={styles.footnote}>{NOTICE}</p>}
          </div>
        </div>
      </Modal>
    </>
  );
}
