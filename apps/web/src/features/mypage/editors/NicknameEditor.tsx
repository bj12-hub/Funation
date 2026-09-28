"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { isValidNickname } from "@/lib/validation";
import { changeNickname, checkNickname } from "@/services/account/profileActions";
import { GENERIC_ERROR, euroParticle, formatKoreanDate } from "./shared";
import styles from "./editors.module.css";

/**
 * Nickname change. Figma: base 743:2020 · invalid 747:28 · duplicate 747:74 · forbidden 747:120
 * · change limit 747:166 · success 747:210
 */

type State =
  | { kind: "IDLE" }
  | { kind: "AVAILABLE" }
  | { kind: "INVALID" }
  | { kind: "DUPLICATE" }
  | { kind: "FORBIDDEN" }
  | { kind: "LIMITED"; availableFrom: string }
  | { kind: "ERROR" }
  | { kind: "CHANGED"; value: string };

const NOTICES: Partial<Record<State["kind"], [string, string]>> = {
  INVALID: ["! 닉네임 형식을 확인해 주세요.", "한글, 영문, 숫자만 사용할 수 있으며 2~12자로 입력해 주세요."],
  DUPLICATE: ["! 이미 사용 중인 닉네임입니다.", "다른 닉네임을 입력한 뒤 중복 확인을 진행해 주세요."],
  FORBIDDEN: ["! 사용할 수 없는 표현이 포함되어 있습니다.", "모두가 편안하게 사용할 수 있는 다른 닉네임을 입력해 주세요."]
};

export function NicknameEditor({ triggerClassName }: { triggerClassName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<State>({ kind: "IDLE" });
  const [busy, setBusy] = useState<"check" | "submit" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openModal() {
    setValue("");
    setState({ kind: "IDLE" });
    setOpen(true);
  }

  function retype() {
    setState({ kind: "IDLE" });
    inputRef.current?.select();
  }

  async function runCheck() {
    if (!isValidNickname(value)) return setState({ kind: "INVALID" });
    setBusy("check");
    try {
      const result = await checkNickname(value);
      setState({ kind: result.status === "AVAILABLE" ? "AVAILABLE" : result.status });
    } catch {
      setState({ kind: "ERROR" });
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!isValidNickname(value)) return setState({ kind: "INVALID" });
    setBusy("submit");
    try {
      const result = await changeNickname(value);
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
      setBusy(null);
    }
  }

  const changed = state.kind === "CHANGED";
  const limited = state.kind === "LIMITED";
  const notice = NOTICES[state.kind];
  const errored = Boolean(notice) || limited;

  const primary = changed || limited
    ? { label: "확인", onClick: () => setOpen(false) }
    : state.kind === "DUPLICATE"
      ? { label: "중복 확인", onClick: runCheck }
      : state.kind === "INVALID" || state.kind === "FORBIDDEN"
        ? { label: "다시 입력", onClick: retype }
        : { label: "변경하기", onClick: submit };

  return (
    <>
      <button type="button" className={triggerClassName} onClick={openModal}>
        수정
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={changed ? "닉네임 변경 완료" : "닉네임 수정"}
        description={changed ? "새 닉네임이 계정에 반영되었습니다." : "다른 회원에게 보여질 닉네임을 변경합니다."}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {changed ? "닫기" : "취소"}
            </button>
            <button type="button" className={styles.primary} onClick={primary.onClick} disabled={busy !== null} aria-busy={busy === "submit" || undefined}>
              {primary.label}
            </button>
          </>
        }
      >
        <div className={styles.content}>
          <div className={styles.field}>
            <label htmlFor="nickname-input" className={styles.nicknameLabel}>
              {changed ? "변경된 닉네임" : "닉네임"}
            </label>
            <div className={styles.nicknameRow}>
              <div className={`${styles.inputBox} ${styles.nicknameBox} ${errored ? styles.inputError : ""} ${changed ? styles.inputSuccess : ""}`}>
                <input
                  id="nickname-input"
                  ref={inputRef}
                  className={`${styles.input} ${changed ? styles.changedValue : ""}`}
                  placeholder="2~12자 이내"
                  maxLength={12}
                  value={changed ? state.value : value}
                  readOnly={changed || limited}
                  aria-invalid={errored || undefined}
                  aria-describedby="nickname-notice"
                  onChange={(e) => {
                    setValue(e.target.value);
                    setState({ kind: "IDLE" });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
              </div>
              {!changed && !limited && (
                <button type="button" className={styles.checkButton} onClick={runCheck} disabled={busy !== null || !value}>
                  중복 확인
                </button>
              )}
            </div>
          </div>

          <div id="nickname-notice" aria-live="polite">
            {state.kind === "AVAILABLE" && <p className={styles.available}>사용 가능한 닉네임입니다.</p>}
            {notice && <Notice tone="error" title={notice[0]} body={notice[1]} />}
            {state.kind === "LIMITED" && (
              <Notice tone="error" title="! 최근 닉네임을 변경한 이력이 있습니다." body={`${formatKoreanDate(state.availableFrom)}부터 다시 변경할 수 있어요.`} />
            )}
            {state.kind === "ERROR" && <Notice tone="error" title={`! ${GENERIC_ERROR}`} body="" />}
            {changed && <Notice tone="success" title="✓ 닉네임 변경이 완료되었습니다." body={`이제 다른 회원에게 “${state.value}”${euroParticle(state.value)} 표시됩니다.`} />}
          </div>
        </div>
      </Modal>
    </>
  );
}

function Notice({ tone, title, body }: { tone: "error" | "success"; title: string; body: string }) {
  return (
    <div className={`${styles.notice} ${tone === "error" ? styles.noticeError : styles.noticeSuccess}`} role={tone === "error" ? "alert" : "status"}>
      <strong className={styles.noticeTitle}>{title}</strong>
      {body && <span className={styles.noticeBody}>{body}</span>}
    </div>
  );
}
