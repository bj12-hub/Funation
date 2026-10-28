"use client";

import { createContext, useContext, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import type { BroadcastLive } from "@/services/crew/crewTypes";
import { unitLabel } from "@/types/donationUnit";
import styles from "./crew.module.css";

type Moments = BroadcastLive["moments"];
/** The live broadcast's start and 후원 리스트 for 시작점 수정 (BroadcastScreen provides it). */
export const MomentsContext = createContext<{ startedAt: string; moments: Moments } | null>(null);

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * 시작점 수정 (2026-10-28, StreamDonate "시작점 수정"): pick the donation (or the broadcast's start) a running count starts
 * from — it counts every donation from then on. `current`: the start now.
 */
export function StartPointPicker({ current, pending, onMove }: { current: string; pending: boolean; onMove: (at: string) => void }) {
  const ctx = useContext(MomentsContext);
  const [at, setAt] = useState("");
  if (!ctx) return null;
  return (
    <span className={styles.startPoint} role="group" aria-label="시작점 수정">
      <select className={styles.select} aria-label="새 시작점" value={at} onChange={(e) => setAt(e.target.value)}>
        <option value="">시작점 수정 — 이 후원부터 세기</option>
        <option value={ctx.startedAt}>방송 시작 · {time(ctx.startedAt)}</option>
        {ctx.moments.map((m, i) => (
          <option key={`${m.at}-${i}`} value={m.at}>
            {time(m.at)} · {m.donor} · {formatNumber(m.amount)} {unitLabel(m.unit)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={styles.ghost}
        disabled={pending || !at || at === current}
        onClick={() => {
          onMove(at);
          setAt("");
        }}
      >
        시작점 바꾸기
      </button>
    </span>
  );
}
