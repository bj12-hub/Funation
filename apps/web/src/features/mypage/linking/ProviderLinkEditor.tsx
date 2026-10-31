"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { linkLoginProvider, unlinkLoginProvider } from "@/services/account/linkingActions";
import type { LoginProvider } from "@/services/account/myAccount";
import { formatLinkedAt } from "./format";
import styles from "./linking.module.css";

/**
 * Social login link management.
 * Figma: not linked 743:2156 (Naver) · linked 743:2203 (Google) / 743:2250 (Kakao).
 * The other combinations reuse these two layouts.
 */

const META: Record<LoginProvider, { name: MessageKey; glyph: string }> = {
  NAVER: { name: "myLink.naver", glyph: "N" },
  GOOGLE: { name: "myLink.google", glyph: "G" },
  KAKAO: { name: "myLink.kakao", glyph: "K" }
};

type Props = {
  provider: LoginProvider;
  link: { identifier: string; linkedAt: string } | null;
  triggerClassName: string;
};

export function ProviderLinkEditor({ provider, link, triggerClassName }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const name = t(META[provider].name);
  const meta = { name, glyph: META[provider].glyph, account: t("myLink.providerAccount", { name }) };

  async function run(action: typeof linkLoginProvider) {
    setBusy(true);
    setError(false);
    try {
      const result = await action(provider);
      if (result.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (result.status === "INVALID") return setError(true);
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
        {link ? t("myLink.manage") : t("myLink.connect")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("myLink.manageTitle", { name: meta.name })}
        description={link ? t("myLink.linkedDesc", { name: meta.name }) : t("myLink.unlinkedDesc", { name: meta.name })}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {t("my.cancel")}
            </button>
            {link ? (
              <button type="button" className={styles.danger} onClick={() => run(unlinkLoginProvider)} disabled={busy} aria-busy={busy || undefined}>
                {t("myLink.disconnect")}
              </button>
            ) : (
              <button type="button" className={styles.primary} onClick={() => run(linkLoginProvider)} disabled={busy} aria-busy={busy || undefined}>
                {t("myLink.connectWith", { name: meta.name })}
              </button>
            )}
          </>
        }
      >
        <div className={styles.content}>
          {link ? (
            <>
              <div className={`${styles.card} ${styles.cardSelected}`}>
                <span className={styles.glyph} aria-hidden="true">
                  {meta.glyph}
                </span>
                <span className={styles.cardText}>
                  <span className={styles.cardTitle}>{meta.account}</span>
                  <span className={styles.cardSub}>{link.identifier}</span>
                </span>
                <span className={`${styles.radio} ${styles.radioOn}`} aria-hidden="true" />
              </div>
              <p className={styles.statusBox}>
                <span className={styles.statusOk}>● {t("myLink.linkedOk")}</span>
                <span>{t("myLink.linkedAt", { date: formatLinkedAt(link.linkedAt) })}</span>
              </p>
              <p className={styles.dangerNote}>{t("myLink.unlinkWarning")}</p>
            </>
          ) : (
            <>
              <div className={`${styles.card} ${styles.cardStatus}`}>
                <span className={styles.glyph} aria-hidden="true">
                  {meta.glyph}
                </span>
                <span className={styles.cardText}>
                  <span className={styles.cardTitle}>{t("myLink.linkAccount", { account: meta.account })}</span>
                  <span className={styles.cardSub}>{t("myLink.noneLinked", { account: meta.account })}</span>
                </span>
              </div>
              <div className={styles.infoList}>
                <span className={styles.infoListTitle}>{t("myLink.provided")}</span>
                <ul className={styles.bullets}>
                  <li>{t("myLink.email", { name: meta.name })}</li>
                  <li>{t("myLink.profileName")}</li>
                  <li>{t("my.photo")}</li>
                </ul>
              </div>
              <p className={`${styles.dangerNote} ${styles.dangerNoteLarge}`}>
                {t("myLink.linkNote", { account: meta.account })}
              </p>
            </>
          )}
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
