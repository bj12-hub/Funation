"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { unblockDonor } from "@/services/creator/donationManagement";
import styles from "./donations.module.css";

/** 해제 with a confirmation (the design has no dialog; the confirm step is ours). */
export function UnblockButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={`${styles.badge} ${styles.badgeFailed}`} onClick={() => setOpen(true)}>
        해제
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="차단을 해제할까요?"
        description={`${name} 님이 다시 후원할 수 있게 됩니다.`}
        footer={
          <>
            <button type="button" className={styles.ghostButton} onClick={() => setOpen(false)} disabled={pending}>
              취소
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
                    } else setError(r.status === "INVALID" ? r.message : "로그인이 필요합니다.");
                  } catch {
                    setError("해제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
                  }
                })
              }
            >
              {pending ? "해제 중…" : "해제"}
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
