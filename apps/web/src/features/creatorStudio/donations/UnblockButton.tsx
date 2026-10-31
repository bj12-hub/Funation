"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { unblockDonor } from "@/services/creator/donationManagement";
import styles from "./donations.module.css";

/** 해제 with a confirmation (the design has no dialog; the confirm step is ours). */
export function UnblockButton({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={`${styles.badge} ${styles.badgeFailed}`} onClick={() => setOpen(true)}>
        {t("studioDonations.unblock")}
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t("studioDonations.unblockTitle")}
        description={t("studioDonations.unblockDesc", { name })}
        footer={
          <>
            <button type="button" className={styles.ghostButton} onClick={() => setOpen(false)} disabled={pending}>
              {t("studioDonations.cancel")}
            </button>
            <button
              type="button"
              className={styles.solidPurple}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  try {
                    const r = await unblockDonor(id);
                    if (r.status === "SAVED") {
                      setOpen(false);
                      router.refresh();
                    } else setError(r.status === "INVALID" ? r.message : t("studioDonations.loginRequired"));
                  } catch {
                    setError(t("studioDonations.unblockFailed"));
                  }
                })
              }
            >
              {pending ? t("studioDonations.unblocking") : t("studioDonations.unblock")}
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
