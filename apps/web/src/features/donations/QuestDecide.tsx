"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { QuestAction, QuestDecideResult } from "@/services/donations/questTypes";
import { QUEST_ACTION_LABEL, QUEST_DECIDE_CONFIRM, QUEST_DECIDE_ERROR, QUEST_DECIDE_FAIL_TEXT } from "./questDecideText";
import styles from "./questDecide.module.css";

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
    if (!window.confirm(QUEST_DECIDE_CONFIRM[outcome])) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await decide({ id, outcome });
        if (res.status === "OK") router.refresh();
        else setError(QUEST_DECIDE_FAIL_TEXT[res.status]);
      } catch {
        setError(QUEST_DECIDE_ERROR);
      }
    });
  };
  return (
    <span className={styles.wrap}>
      <span className={styles.buttons}>
        {actions.map((a) => (
          <button key={a} type="button" className={a === "SUCCESS" ? styles.success : styles.fail} disabled={pending} onClick={() => run(a)}>
            {QUEST_ACTION_LABEL[a]}
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
