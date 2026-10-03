"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { QuestAction, QuestDecideResult } from "@/services/donations/questTypes";
import styles from "./questDecide.module.css";

const CONFIRM: Record<QuestAction, string> = {
  SUCCESS: "퀘스트를 성공으로 정할까요? 정한 결과는 바꿀 수 없어요.",
  FAILED: "퀘스트를 실패로 정할까요? 후원한 FN은 후원자에게 전액 환불되고, 정한 결과는 바꿀 수 없어요.",
  CANCELED: "퀘스트를 취소할까요? 후원한 FN은 후원자에게 전액 환불되고, 되돌릴 수 없어요."
};

const LABEL: Record<QuestAction, string> = { SUCCESS: "성공", FAILED: "실패 · 환불", CANCELED: "취소 · 환불" };

const FAIL_TEXT: Record<Exclude<QuestDecideResult["status"], "OK">, string> = {
  ALREADY_DECIDED: "이미 다른 결과로 정해진 퀘스트예요.",
  FORBIDDEN: "이 퀘스트는 후원자만 결과를 정할 수 있어요.",
  NOT_FOUND: "퀘스트를 찾을 수 없어요.",
  INVALID: "요청을 확인해 주세요.",
  UNAUTHORIZED: "다시 로그인해 주세요."
};

/**
 * 퀘스트 결과 버튼 (code-first): 성공 / 실패 · 환불 / 취소 · 환불 (`actions`), each confirmed first. `decide` is
 * the server action of the side that is deciding (the creator's 받은 후원 or the supporter's 후원 내역).
 */
export function QuestDecide({
  id,
  decide,
  actions = ["SUCCESS", "FAILED"]
}: {
  id: string;
  decide: (input: { id: string; outcome: QuestAction }) => Promise<QuestDecideResult>;
  actions?: QuestAction[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (outcome: QuestAction) => {
    if (!window.confirm(CONFIRM[outcome])) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await decide({ id, outcome });
        if (res.status === "OK") router.refresh();
        else setError(FAIL_TEXT[res.status]);
      } catch {
        setError("처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };
  return (
    <span className={styles.wrap}>
      <span className={styles.buttons}>
        {actions.map((a) => (
          <button key={a} type="button" className={a === "SUCCESS" ? styles.success : styles.fail} disabled={pending} onClick={() => run(a)}>
            {LABEL[a]}
          </button>
        ))}
      </span>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
