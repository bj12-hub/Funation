"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { undoDonationImport } from "@/services/creator/donationImport";
import { IMPORT_SOURCE_LABEL, type ImportSource } from "@/services/creator/donationImportTypes";
import styles from "./donations.module.css";

/** 되돌리기 with a confirmation — removal is final (code-first, no Figma frame). */
export function UndoImportButton({ batchId, source, when, count }: { batchId: string; source: ImportSource; when: string; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={`${styles.badge} ${styles.badgeFailed}`} onClick={() => setOpen(true)}>
        되돌리기
      </button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="가져온 내역을 되돌릴까요?"
        description={`${when}에 ${IMPORT_SOURCE_LABEL[source]}에서 가져온 ${formatNumber(count)}건을 지워요. 지운 내역은 되살릴 수 없어요.${
          source === "FLEXTV" ? " FlexTV 내역 가져오기를 다시 눌러도 이 내역은 다시 가져오지 않아요." : " 같은 파일을 다시 올리면 다시 가져올 수 있어요."
        }`}
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
                    const r = await undoDonationImport({ batchId });
                    if (r.status === "UNDONE") {
                      setOpen(false);
                      router.refresh();
                    } else setError(r.status === "NOT_FOUND" ? "이미 없는 기록이에요. 화면을 새로 고쳐 주세요." : "로그인이 필요합니다.");
                  } catch {
                    setError("되돌리지 못했어요. 잠시 후 다시 시도해 주세요.");
                  }
                })
              }
            >
              {pending ? "되돌리는 중…" : "되돌리기"}
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
