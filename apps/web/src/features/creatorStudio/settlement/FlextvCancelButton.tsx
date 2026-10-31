"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cancelExchange } from "@/services/creator/flextvSettlement";
import styles from "./flextv.module.css";

/** 취소 of a 정산 신청 still in 신청 (FLEXTV's rule); the server checks the request is the member's own and still open. */
export function FlextvCancelButton({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancel = () =>
    startTransition(async () => {
      const r = await cancelExchange(id);
      if (r.status === "UNAUTHORIZED") return router.push("/login?role=creator&next=/creator/settlement/manage");
      if (r.status === "CANCELED") {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(r.status === "INVALID" ? r.message : t("flextvSettlement.noResponse"));
      router.refresh();
    });

  return (
    <>
      <button type="button" className={styles.linkButton} style={{ marginLeft: 8 }} onClick={() => (setError(null), setOpen(true))}>
        {t("flextvSettlement.cancel")}
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={t("flextvSettlement.cancelTitle")}
        description={t("flextvSettlement.cancelDescription")}
        footer={
          <>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => setOpen(false)}>
              {t("flextvSettlement.close")}
            </button>
            <button type="button" className={styles.primaryButton} disabled={pending} aria-busy={pending || undefined} onClick={cancel}>
              {pending ? t("flextvSettlement.canceling") : t("flextvSettlement.cancelRequest")}
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
