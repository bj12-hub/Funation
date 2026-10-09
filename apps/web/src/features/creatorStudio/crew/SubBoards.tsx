"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { closeSubBoard, openSubBoard } from "@/services/crew/crewBoards";
import { SUB_BOARD_MAX, SUB_BOARD_TITLE_MAX, type BroadcastResult, type SubBoard } from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import styles from "./crew.module.css";
import feed from "./feed.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });

/**
 * 서브 점수판 — code-first (no Figma frame), inside `/creator/crew/broadcast` while live. "새 판" opens
 * a board (closing the previous one); each scores the FN members received while it was open.
 */
export function SubBoards({
  broadcastId,
  boards,
  overlayPath,
  pending,
  run
}: {
  broadcastId: string;
  boards: SubBoard[];
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const requestId = useRef<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const full = boards.length >= SUB_BOARD_MAX;

  const open = () => {
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    run(async () => {
      const res = await openSubBoard({ broadcastId, requestId: id, title });
      if (res.status === "SAVED") {
        requestId.current = null;
        setTitle("");
      }
      return res;
    }, "새 판을 열었어요.");
  };

  return (
    <section className={styles.card} aria-labelledby="bc-subboards">
      <div className={styles.cardHead}>
        <h2 id="bc-subboards" className={styles.cardTitle}>
          서브 점수판
        </h2>
        <span className={styles.muted}>
          {boards.length}/{SUB_BOARD_MAX}판
        </span>
      </div>
      <p className={styles.note}>
        메인 점수판 아래에 두는 구간 점수판이에요. 판이 열려 있는 동안 멤버가 받은 후원(멤버 지정 + 후원 리스트 반영)만 집계해요. 새 판을 열면 이전 판은 마감돼요.
      </p>
      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <input
          className={styles.input}
          aria-label="판 이름"
          placeholder={`판 이름 (비우면 서브 ${boards.length + 1}판)`}
          maxLength={SUB_BOARD_TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className={styles.primary} disabled={pending || full}>
          새 판
        </button>
      </form>
      {boards.length === 0 ? (
        <p className={styles.empty}>아직 서브 점수판이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {[...boards].reverse().map((b) => (
            <li key={b.no} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {b.no}. {b.title}
                  <span className={feed.status} data-status={b.closedAt ? "CANCELLED" : "ASSIGNED"}>
                    {b.closedAt ? "마감" : "진행 중"}
                  </span>
                </span>
                <span className={styles.muted}>
                  {time(b.openedAt)} ~ {b.closedAt ? time(b.closedAt) : "지금"} ·{" "}
                  {b.rows.filter((r) => r.score > 0).length
                    ? b.rows
                        .filter((r) => r.score > 0)
                        .slice(0, 3)
                        .map((r, i) => `${i + 1}. ${r.name} ${formatNumber(r.score)}`)
                        .join("  ")
                    : "아직 점수 없음"}
                </span>
              </div>
              <span className={styles.rowActions}>
                <CopyButton value={`${origin}${overlayPath}?board=${b.no}`} label="OBS 주소" className={styles.ghost} />
                {!b.closedAt && (
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => closeSubBoard({ broadcastId, no: b.no }), "판을 마감했어요.")}>
                    마감
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
