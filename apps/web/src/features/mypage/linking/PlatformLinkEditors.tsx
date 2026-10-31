"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlusSmallIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { connectPlatform, disconnectPlatform } from "@/services/account/linkingActions";
import type { Platform } from "@/types/platform";
import styles from "./linking.module.css";

/**
 * Broadcasting platform links on my page.
 * Figma: 연결 해제 743:2465 (YouTube) · 계정 연결 743:2511 (FLEX TV).
 * Other platforms reuse the same layouts with their own name (not separately designed).
 */

const GLYPH: Record<Platform, string> = { YOUTUBE: "▶", FLEXTV: "F", SOOP: "S", CHZZK: "C" };

type DisconnectProps = { platform: Platform; label: string; handle: string; triggerClassName: string };

export function PlatformDisconnect({ platform, label, handle, triggerClassName }: DisconnectProps) {
  const { t } = useI18n();
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
        {t("myLink.disconnect")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("myLink.disconnectTitle", { label })}
        description={t("myLink.disconnectDesc", { label })}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {t("my.cancel")}
            </button>
            <button type="button" className={styles.danger} onClick={disconnect} disabled={busy} aria-busy={busy || undefined}>
              {t("myLink.disconnect")}
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
            {t("myLink.disconnectWarning")}
          </p>
          {error && (
            <p className={styles.fieldError} role="alert">
              {t("my.genericError")}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

type ConnectProps = { platform: Platform; label: string; triggerClassName: string };

export function PlatformConnect({ platform, label, triggerClassName }: ConnectProps) {
  const { t } = useI18n();
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
        {t("myLink.addConnection")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("myLink.connectTitle", { label })}
        description={t("myLink.connectDesc", { label })}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {t("my.cancel")}
            </button>
            <button type="submit" form={`connect-${platform}`} className={styles.primary} disabled={busy} aria-busy={busy || undefined}>
              {t("myLink.connectAccount")}
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
              {t("myLink.accountId", { label })}
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
              {t("myLink.code")}
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
              {error === "CODE" && <span className={styles.inlineError}>{t("my.needsCheck")}</span>}
            </div>
          </div>
          <p className={styles.infoBox}>{t("myLink.codeInfo", { label })}</p>
          {error && (
            <p className={styles.fieldError} role="alert">
              {/* Error copy is not in Figma (TBD). */}
              {error === "ACCOUNT" ? t("myLink.checkAccountId", { label }) : error === "CODE" ? t("myLink.checkCode") : t("my.genericError")}
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
