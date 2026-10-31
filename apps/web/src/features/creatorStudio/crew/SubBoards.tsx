"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();
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
    }, t("crewOpsScenario.subOpened"));
  };

  return (
    <section className={styles.card} aria-labelledby="bc-subboards">
      <div className={styles.cardHead}>
        <h2 id="bc-subboards" className={styles.cardTitle}>
          {t("crewOpsScenario.subBoard")}
        </h2>
        <span className={styles.muted}>
          {t("crewOpsScenario.subCount", { count: boards.length, max: SUB_BOARD_MAX })}
        </span>
      </div>
      <p className={styles.note}>{t("crewOpsScenario.subNote")}</p>
      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <input
          className={styles.input}
          aria-label={t("crewOpsScenario.subNameAria")}
          placeholder={t("crewOpsScenario.subNamePlaceholder", { n: boards.length + 1 })}
          maxLength={SUB_BOARD_TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className={styles.primary} disabled={pending || full}>
          {t("crewOpsScenario.subNew")}
        </button>
      </form>
      {boards.length === 0 ? (
        <p className={styles.empty}>{t("crewOpsScenario.subEmpty")}</p>
      ) : (
        <ul className={styles.list}>
          {[...boards].reverse().map((b) => (
            <li key={b.no} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  {b.no}. {b.title}
                  <span className={feed.status} data-status={b.closedAt ? "CANCELLED" : "ASSIGNED"}>
                    {b.closedAt ? t("crewOpsScenario.subClosed") : t("crewOpsScenario.subOpen")}
                  </span>
                </span>
                <span className={styles.muted}>
                  {time(b.openedAt)} ~ {b.closedAt ? time(b.closedAt) : t("crewOpsScenario.subNow")} ·{" "}
                  {b.rows.filter((r) => r.score > 0).length
                    ? b.rows
                        .filter((r) => r.score > 0)
                        .slice(0, 3)
                        .map((r, i) => `${i + 1}. ${r.name} ${formatNumber(r.score)}`)
                        .join("  ")
                    : t("crewOpsScenario.subNoScore")}
                </span>
              </div>
              <span className={styles.rowActions}>
                <CopyButton value={`${origin}${overlayPath}?board=${b.no}`} label={t("crewOpsScenario.subObsAddress")} className={styles.ghost} />
                {!b.closedAt && (
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => closeSubBoard({ broadcastId, no: b.no }), t("crewOpsScenario.subClosedDone"))}>
                    {t("crewOpsScenario.subClose")}
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
