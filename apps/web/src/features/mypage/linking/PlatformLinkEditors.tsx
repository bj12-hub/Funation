"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusSmallIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { connectPlatform, disconnectPlatform } from "@/services/account/linkingActions";
import type { Platform } from "@/types/platform";
import styles from "./linking.module.css";

/**
 * Broadcasting platform links on my page.
 * Figma: 연결 해제 743:2465 (YouTube) · 계정 연결 743:2511 (FLEX TV).
 * Other platforms reuse the same layouts with their own name (not separately designed).
 */

const GLYPH: Record<Platform, string> = { YOUTUBE: "▶", FLEXTV: "F", SOOP: "S" };
const GENERIC_ERROR = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요";

type DisconnectProps = { platform: Platform; label: string; handle: string; triggerClassName: string };

export function PlatformDisconnect({ platform, label, handle, triggerClassName }: DisconnectProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function disconnect() {
    setBusy(true);
    setError(false);
    try {
      const result = await disconnectPlatform(platform);
      if (result.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (result.status !== "DISCONNECTED") return setError(true);
      setOpen(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        연결 해제
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${label} 연결 해제`}
        description={`${label} 계정 연결을 해제하시겠어요?`}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              취소
            </button>
            <button type="button" className={styles.danger} onClick={disconnect} disabled={busy} aria-busy={busy || undefined}>
              연결 해제
            </button>
          </>
        }
      >
        <div className={styles.content}>
          <div className={`${styles.card} ${styles.cardSelected}`}>
            <span className={styles.glyph} aria-hidden="true">
              {GLYPH[platform]}
            </span>
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>{label}</span>
              <span className={styles.cardSub}>{handle}</span>
            </span>
            <span className={`${styles.radio} ${styles.radioOn}`} aria-hidden="true" />
          </div>
          <p className={styles.warningBox}>
            <span className={styles.warningGlyph} aria-hidden="true">
              !
            </span>{" "}
            연결을 해제하면 채널 활동 기반 리워드와 연동 혜택이 중단됩니다.
          </p>
          {error && (
            <p className={styles.fieldError} role="alert">
              {GENERIC_ERROR}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

type ConnectProps = { platform: Platform; label: string; triggerClassName: string };

export function PlatformConnect({ platform, label, triggerClassName }: ConnectProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<"ACCOUNT" | "CODE" | "ERROR" | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    if (!accountId.trim()) return setError("ACCOUNT");
    if (!code.trim()) return setError("CODE");
    setBusy(true);
    setError(null);
    try {
      const result = await connectPlatform({ platform, accountId: accountId.trim(), code: code.trim() });
      if (result.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (result.status === "INVALID") return setError("ACCOUNT");
      if (result.status === "INVALID_CODE") return setError("CODE");
      setOpen(false);
      router.refresh();
    } catch {
      setError("ERROR");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setAccountId("");
          setCode("");
          setError(null);
          setOpen(true);
        }}
      >
        <PlusSmallIcon />
        연결 추가
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${label} 계정 연결`}
        description={`${label} 계정을 연결해 리워드를 받아보세요.`}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              취소
            </button>
            <button type="submit" form={`connect-${platform}`} className={styles.primary} disabled={busy} aria-busy={busy || undefined}>
              계정 연결
            </button>
          </>
        }
      >
        <form
          id={`connect-${platform}`}
          className={styles.content}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
        >
          <div className={styles.field}>
            <label htmlFor={`connect-${platform}-id`} className={styles.label}>
              {label} 계정 ID
            </label>
            <div className={`${styles.inputBox} ${error === "ACCOUNT" ? styles.inputError : ""}`}>
              <input
                id={`connect-${platform}-id`}
                className={styles.input}
                autoComplete="off"
                maxLength={40}
                value={accountId}
                aria-invalid={error === "ACCOUNT" || undefined}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setError(null);
                }}
              />
            </div>
          </div>
          <div className={styles.field}>
            <label htmlFor={`connect-${platform}-code`} className={styles.label}>
              연결 인증 코드
            </label>
            <div className={`${styles.inputBox} ${error === "CODE" ? styles.inputError : ""}`}>
              <input
                id={`connect-${platform}-code`}
                className={styles.input}
                autoComplete="one-time-code"
                maxLength={40}
                value={code}
                aria-invalid={error === "CODE" || undefined}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
              />
              {error === "CODE" && <span className={styles.inlineError}>확인 필요</span>}
            </div>
          </div>
          <p className={styles.infoBox}>{label}에서 발급받은 인증 코드를 입력하면 계정 소유 확인 후 즉시 연결됩니다.</p>
          {error && (
            <p className={styles.fieldError} role="alert">
              {/* Error copy is not in Figma (TBD). */}
              {error === "ACCOUNT" ? `${label} 계정 ID를 확인해 주세요.` : error === "CODE" ? "인증 코드를 확인해 주세요." : GENERIC_ERROR}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
