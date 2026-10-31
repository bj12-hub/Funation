"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { verifyIdentity, type VerificationMethod, type VerificationResult } from "@/services/account/linkingActions";
import { formatDotDate, formatDotDateTime } from "./format";
import styles from "./linking.module.css";

/**
 * Identity verification (본인인증).
 * Figma: method choice 743:2297 · already verified 750:153 · duplicate account 750:205
 * · attempts exceeded 750:257 · success 750:306
 * The provider hand-off itself (phone / i-PIN screens) is outside Ssumnation and TBD.
 */

const METHODS: { value: VerificationMethod; glyph: string; title: MessageKey; sub: MessageKey }[] = [
  { value: "PHONE", glyph: "P", title: "myLink.phone", sub: "myLink.phoneSub" },
  { value: "IPIN", glyph: "I", title: "myLink.ipin", sub: "myLink.ipinSub" }
];

type Result = Exclude<VerificationResult, { status: "INVALID" | "UNAUTHORIZED" }>;
type T = ReturnType<typeof useI18n>["t"];

export function IdentityVerification({ triggerClassName }: { triggerClassName: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<VerificationMethod>("PHONE");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  function close() {
    setOpen(false);
    if (result?.status === "VERIFIED") router.refresh();
  }

  async function start() {
    setBusy(true);
    setError(false);
    try {
      const r = await verifyIdentity(method);
      if (r.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (r.status === "INVALID") return setError(true);
      setResult(r);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const view = result ? resultView(result, t) : null;

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setResult(null);
          setError(false);
          setOpen(true);
        }}
      >
        {t("myLink.verify")}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={view ? view.title : t("myLink.verifyTitle")}
        description={view ? undefined : t("myLink.verifyDesc")}
        customHeader={
          view && (
            <header className={`${styles.resultHeader} ${view.tone === "success" ? styles.success : styles.warning}`}>
              <div className={styles.resultLabelRow}>
                <span className={styles.resultLabel}>{view.label}</span>
                <button type="button" className={styles.close} aria-label={t("my.close")} onClick={close}>
                  ×
                </button>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultIcon} aria-hidden="true">
                  {view.tone === "success" ? "✓" : "!"}
                </span>
                <div className={styles.resultText}>
                  <h2 className={styles.resultTitle}>{view.title}</h2>
                  <p className={styles.resultDescription}>{view.description}</p>
                </div>
              </div>
            </header>
          )
        }
        footer={
          view ? (
            view.actions(close)
          ) : (
            <>
              <button type="button" className={styles.secondary} onClick={close}>
                {t("my.cancel")}
              </button>
              <button type="button" className={styles.primary} onClick={start} disabled={busy} aria-busy={busy || undefined}>
                {t("myLink.verifyStart")}
              </button>
            </>
          )
        }
      >
        {view ? (
          <div className={`${styles.detailBox} ${view.tone === "success" ? styles.success : styles.warning}`}>
            <span className={styles.detailTitle}>{view.detailTitle}</span>
            <ul className={styles.detailRows}>{view.rows}</ul>
          </div>
        ) : (
          <div className={styles.content}>
            <div role="radiogroup" aria-label={t("myLink.method")} className={styles.content}>
              {METHODS.map((m) => {
                const selected = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
                    onClick={() => setMethod(m.value)}
                  >
                    <span className={styles.glyph} aria-hidden="true">
                      {m.glyph}
                    </span>
                    <span className={styles.cardText}>
                      <span className={styles.cardTitle}>{t(m.title)}</span>
                      <span className={styles.cardSub}>{t(m.sub)}</span>
                    </span>
                    <span className={`${styles.radio} ${selected ? styles.radioOn : ""}`} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <p className={styles.infoBox}>{t("myLink.verifyInfo")}</p>
            {error && (
              <p className={styles.fieldError} role="alert">
                {t("my.genericError")}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

/** Minutes until the server-provided unlock time (Figma 750:257 "약 30분 후"). */
function minutesUntil(iso: string) {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <li>
      <span>
        {label && <span className={styles.detailLabel}>{label}</span>}
        {children}
      </span>
    </li>
  );
}

type View = {
  tone: "success" | "warning";
  label: string;
  title: string;
  description: string;
  detailTitle: string;
  rows: ReactNode;
  actions: (close: () => void) => ReactNode;
};

/** 닫기 + a primary button that also just closes (Figma 750:153 · 750:306). */
function closeAndConfirm(primary: string, closeLabel: string) {
  return function renderActions(close: () => void) {
    return (
      <>
        <button type="button" className={styles.secondary} onClick={close}>
          {closeLabel}
        </button>
        <button type="button" className={styles.primary} onClick={close}>
          {primary}
        </button>
      </>
    );
  };
}

function resultView(r: Result, t: T): View {

  switch (r.status) {
    case "VERIFIED":
      return {
        tone: "success",
        label: t("my.verified"),
        title: t("myLink.verifiedTitle"),
        description: t("myLink.verifiedDesc"),
        detailTitle: t("myLink.result"),
        rows: (
          <>
            <Row label={t("myLink.verifiedBy")}>{r.name}</Row>
            <Row label={t("myLink.verifiedAt")}>{formatDotDateTime(r.verifiedAt)}</Row>
          </>
        ),
        actions: closeAndConfirm(t("myLink.backToMyPage"), t("my.close"))
      };
    case "ALREADY_VERIFIED":
      return {
        tone: "success",
        label: t("myLink.alreadyLabel"),
        title: t("myLink.alreadyTitle"),
        description: t("myLink.alreadyDesc"),
        detailTitle: t("myLink.details"),
        rows: (
          <>
            <Row label={t("myLink.verifiedBy")}>{r.name}</Row>
            <Row label={t("myLink.birthDate")}>{formatDotDate(r.birthDate)}</Row>
            <Row label={t("myLink.verifiedAt")}>{formatDotDateTime(r.verifiedAt)}</Row>
          </>
        ),
        actions: closeAndConfirm(t("my.ok"), t("my.close"))
      };
    case "DUPLICATE":
      return {
        tone: "warning",
        label: t("myLink.duplicateLabel"),
        title: t("myLink.duplicateTitle"),
        description: t("myLink.duplicateDesc"),
        detailTitle: t("myLink.duplicateAccount"),
        rows: (
          <>
            <Row label={t("my.ssumnationId")}>{r.maskedSsumnationId}</Row>
            <Row label={t("myLink.joinedAt")}>{formatDotDate(r.joinedAt)}</Row>
            <Row>{t("myLink.partialInfo")}</Row>
          </>
        ),
        // TBD: Figma does not define these destinations; the closest existing screens are used.
        actions: () => (
          <>
            <Link href="/login" className={styles.secondary}>
              {t("myLink.backToLogin")}
            </Link>
            <Link href="/password-reset" className={styles.primary}>
              {t("myLink.findAccount")}
            </Link>
          </>
        )
      };
    case "LOCKED":
      return {
        tone: "warning",
        label: t("myLink.lockedLabel"),
        title: t("myLink.lockedTitle"),
        description: t("myLink.lockedDesc"),
        detailTitle: t("myLink.retryAvailable"),
        rows: (
          <>
            <Row label={t("myLink.unlockAt")}>{formatDotDateTime(r.retryAt)}</Row>
            <Row>{t("myLink.retryIn", { minutes: minutesUntil(r.retryAt) })}</Row>
          </>
        ),
        actions: (close) => (
          <>
            <Link href="/support" className={styles.secondary}>
              {t("myLink.support")}
            </Link>
            <button type="button" className={styles.primary} onClick={close}>
              {t("my.ok")}
            </button>
          </>
        )
      };
  }
}
