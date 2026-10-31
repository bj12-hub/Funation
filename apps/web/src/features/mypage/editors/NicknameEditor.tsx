"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { isValidNickname } from "@/lib/validation";
import { changeNickname, checkNickname } from "@/services/account/profileActions";
import { euroParticle, formatKoreanDate } from "./shared";
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

const NOTICES: Partial<Record<State["kind"], [MessageKey, MessageKey]>> = {
  INVALID: ["myEdit.nickInvalid", "myEdit.nickInvalidHint"],
  DUPLICATE: ["myEdit.nickDuplicate", "myEdit.nickDuplicateHint"],
  FORBIDDEN: ["myEdit.forbidden", "myEdit.nickForbiddenHint"]
};

export function NicknameEditor({ triggerClassName }: { triggerClassName: string }) {
  const { t, locale } = useI18n();
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
    ? { label: t("my.ok"), onClick: () => setOpen(false) }
    : state.kind === "DUPLICATE"
      ? { label: t("myEdit.nickCheck"), onClick: runCheck }
      : state.kind === "INVALID" || state.kind === "FORBIDDEN"
        ? { label: t("myEdit.nickRetype"), onClick: retype }
        : { label: t("myEdit.nickSubmit"), onClick: submit };

  return (
    <>
      <button type="button" className={triggerClassName} onClick={openModal}>
        {t("my.edit")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={changed ? t("myEdit.nickChangedTitle") : t("myEdit.nickTitle")}
        description={changed ? t("myEdit.nickChangedDesc") : t("myEdit.nickDesc")}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {changed ? t("my.close") : t("my.cancel")}
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
              {changed ? t("myEdit.nickChangedLabel") : t("my.nickname")}
            </label>
            <div className={styles.nicknameRow}>
              <div className={`${styles.inputBox} ${styles.nicknameBox} ${errored ? styles.inputError : ""} ${changed ? styles.inputSuccess : ""}`}>
                <input
                  id="nickname-input"
                  ref={inputRef}
                  className={`${styles.input} ${changed ? styles.changedValue : ""}`}
                  placeholder={t("myEdit.nickPlaceholder")}
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
                  {t("myEdit.nickCheck")}
                </button>
              )}
            </div>
          </div>

          <div id="nickname-notice" aria-live="polite">
            {state.kind === "AVAILABLE" && <p className={styles.available}>{t("myEdit.nickAvailable")}</p>}
            {notice && <Notice tone="error" title={`! ${t(notice[0])}`} body={t(notice[1])} />}
            {state.kind === "LIMITED" && (
              <Notice tone="error" title={`! ${t("myEdit.nickLimited")}`} body={t("myEdit.nickLimitedHint", { date: formatKoreanDate(state.availableFrom, locale) })} />
            )}
            {state.kind === "ERROR" && <Notice tone="error" title={`! ${t("my.genericError")}`} body="" />}
            {changed && (
              <Notice
                tone="success"
                title={`✓ ${t("myEdit.nickChanged")}`}
                body={t("myEdit.nickChangedHint", { name: state.value, particle: euroParticle(state.value) })}
              />
            )}
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
