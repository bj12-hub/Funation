"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { cancelExchange } from "@/services/creator/flextvSettlement";
import styles from "./flextv.module.css";

/** 취소 of a 정산 신청 still in 신청 (FLEXTV's rule); the server checks the request is the member's own and still open. */
export function FlextvCancelButton({ id }: { id: string }) {
  const router = useRouter();
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
      setError(r.status === "INVALID" ? r.message : "FLEXTV가 응답하지 않았어요. 잠시 후 내역을 다시 확인해 주세요.");
      router.refresh();
    });

  return (
    <>
      <button type="button" className={styles.linkButton} style={{ marginLeft: 8 }} onClick={() => (setError(null), setOpen(true))}>
        취소
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="정산 신청을 취소할까요?"
        description="취소한 렉스는 정산 가능 렉스로 돌아와요."
        footer={
          <>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => setOpen(false)}>
              닫기
            </button>
            <button type="button" className={styles.primaryButton} disabled={pending} aria-busy={pending || undefined} onClick={cancel}>
              {pending ? "취소하는 중..." : "신청 취소"}
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
