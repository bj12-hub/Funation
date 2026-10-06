"use client";

import Link from "next/link";
import type { BingoState, ToolResult } from "@/services/creator/broadcastToolTypes";
import styles from "../crew/crew.module.css";
import { BingoPlay } from "../widgets/BingoTool";

/**
 * 리모컨 "🎯 빙고" card — code-first (2026-10-06 결정: 리모컨에서도 칸 표시). The same board as 방송 도구: mark cells,
 * 표시 초기화, 화면에 보이기 / 내리기. Missions, size and goal are edited on /creator/widgets/tools.
 */
export function BingoRemote({ bingo, pending, run }: { bingo: BingoState; pending: boolean; run: (action: () => Promise<ToolResult>, ok?: string) => void }) {
  return (
    <section className={styles.card} aria-labelledby="bingo-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="bingo-remote">
          🎯 빙고
        </h2>
        <Link href="/creator/widgets/tools#tool-bingo" className={styles.ghost}>
          판 편집
        </Link>
      </div>
      <BingoPlay state={bingo} pending={pending} run={run} />
    </section>
  );
}
