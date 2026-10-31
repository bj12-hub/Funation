"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { undoDonationImport } from "@/services/creator/donationImport";
import { IMPORT_SOURCE_LABEL, type ImportSource } from "@/services/creator/donationImportTypes";
import styles from "./donations.module.css";

/** 되돌리기 with a confirmation — removal is final (code-first, no Figma frame). */
export function UndoImportButton({ batchId, source, when, count }: { batchId: string; source: ImportSource; when: string; count: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={`${styles.badge} ${styles.badgeFailed}`} onClick={() => setOpen(true)}>
        {t("studioDonationsImport.undo")}
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t("studioDonationsImport.undoTitle")}
        description={`${t("studioDonationsImport.undoDesc", { when, source: IMPORT_SOURCE_LABEL[source], count: formatNumber(count) })}${
          source === "FLEXTV" ? t("studioDonationsImport.undoDescFlextv") : t("studioDonationsImport.undoDescFile")
        }`}
        footer={
          <>
            <button type="button" className={styles.ghostButton} onClick={() => setOpen(false)} disabled={pending}>
              {t("studioDonationsImport.cancel")}
            </button>
            <button
              type="button"
              className={styles.solidPurple}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  try {
                    const r = await undoDonationImport({ batchId });
                    if (r.status === "UNDONE") {
                      setOpen(false);
                      router.refresh();
                    } else setError(r.status === "NOT_FOUND" ? t("studioDonationsImport.notFound") : t("studioDonationsImport.loginRequired"));
                  } catch {
                    setError(t("studioDonationsImport.undoFailed"));
                  }
                })
              }
            >
              {pending ? t("studioDonationsImport.undoing") : t("studioDonationsImport.undo")}
            </button>
          </>
        }
      >
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
