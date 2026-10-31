"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { reissueSignaturePageKey, setSignaturePageEnabled } from "@/services/donations/signatures";
import type { SignaturePageSettings, SignatureResult } from "@/services/donations/signatureTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";

/** The address with the key hidden after its first 4 characters (the copy button copies it whole). */
const masked = (path: string) => path.replace(/[^/]+$/, (key) => `${key.slice(0, 4)}-····-····-····`);

/**
 * 공개 시그니처 페이지 · 시그니처 ZIP — code-first (no Figma frame; StreamDonate 시그니처 관리 참고, 2026-10-25), in
 * `/creator/widgets/signatures`. The public page (off by default): 사용, its address (masked, copy, 열어 보기) and 재발급.
 * The ZIP: every signature's image and sound with 시그니처 목록 (CSV), from `/api/creator/signatures/zip`.
 */
export function SignatureShareCard({ page }: { page: SignaturePageSettings }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const run = (action: () => Promise<SignatureResult>, ok: string) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          setNote({ tone: "ok", text: ok });
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") });
      } catch {
        setNote({ tone: "error", text: t("studioTools.processFailed") });
      }
    });
  };

  return (
    <section className={styles.card} aria-labelledby="sig-share">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="sig-share">
          {t("studioToolsSignatures.shareTitle")}
        </h2>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={page.enabled}
            disabled={pending}
            onChange={(e) => {
              const on = e.target.checked;
              run(() => setSignaturePageEnabled({ enabled: on }), on ? t("studioToolsSignatures.pageOn") : t("studioToolsSignatures.pageOff"));
            }}
          />
          {t("studioToolsSignatures.usePage")}
        </label>
      </div>
      <p className={styles.note}>{t("studioToolsSignatures.shareNote")}</p>
      <div className={styles.addRow}>
        <input className={styles.input} readOnly aria-label={t("studioToolsSignatures.pageAddress")} value={`${origin}${masked(page.path)}`} />
        <CopyButton value={`${origin}${page.path}`} label={t("studioTools.copyAddress")} className={styles.ghost} />
        {page.enabled && (
          <a className={styles.ghost} href={page.path} target="_blank" rel="noreferrer">
            {t("studioToolsSignatures.open")}
          </a>
        )}
        <button
          type="button"
          className={styles.ghost}
          disabled={pending}
          onClick={() => window.confirm(t("studioToolsSignatures.reissueConfirm")) && run(reissueSignaturePageKey, t("studioToolsSignatures.reissued"))}
        >
          {t("studioTools.reissue")}
        </button>
      </div>
      <div className={styles.addRow}>
        <a className={styles.ghost} href="/api/creator/signatures/zip" download>
          {t("studioToolsSignatures.zip")}
        </a>
        <span className={styles.note}>{t("studioToolsSignatures.zipNote")}</span>
      </div>
      {note && (
        <p className={note.tone === "ok" ? styles.ok : styles.error} role={note.tone === "ok" ? "status" : "alert"}>
          {note.text}
        </p>
      )}
    </section>
  );
}
