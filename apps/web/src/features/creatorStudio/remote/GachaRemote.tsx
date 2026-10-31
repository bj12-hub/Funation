"use client";

import Link from "next/link";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { finishGachaDraw, setGachaClaimed, setGachaHidden } from "@/services/creator/gachaRemote";
import type { GachaControlResult, GachaDrawStatus, GachaRemoteView, GachaRow } from "@/services/donations/gachaTypes";
import styles from "../crew/crew.module.css";
import remote from "./remote.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** `GACHA_STATUS_LABEL` as message keys (2026-11-01). */
const STATUS_KEY: Record<GachaDrawStatus, MessageKey> = {
  QUEUED: "studioRemote.gachaQueued",
  SPINNING: "studioRemote.drawing",
  RESULT: "studioRemote.resultCheck",
  DONE: "studioRemote.statusDone"
};

/**
 * 리모컨 "뽑기" card — code-first (펀페이 1009:6549 실행 대기 · 1009:6768 결과 확인). Draws play in order on
 * the 뽑기 overlay; ✓ 완료 takes a shown result down early and 수령 처리 marks a prize as handed over.
 * Prizes and odds live in the 뽑기 위젯 settings.
 */
export function GachaRemote({
  view,
  pending,
  run
}: {
  view: GachaRemoteView;
  pending: boolean;
  run: (action: () => Promise<GachaControlResult>, ok?: string) => void;
}) {
  const { t } = useI18n();
  const s = view.stage;
  return (
    <section className={styles.card} aria-labelledby="gacha-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="gacha-remote">
          {t("studioRemote.gachaTitle")}
        </h2>
        <Link href="/creator/widgets?open=GACHA" className={styles.ghost}>
          {t("studioRemote.gachaSettings")}
        </Link>
      </div>
      <p className={styles.note}>{t("studioRemote.gachaNote")}</p>
      <div className={remote.status}>
        <span>{t("studioRemote.gachaStatus", { queue: view.queue.length, unclaimed: view.unclaimed })}</span>
        <button
          type="button"
          className={view.hidden ? styles.chip : styles.chipOff}
          aria-pressed={view.hidden}
          disabled={pending}
          onClick={() => run(() => setGachaHidden({ hidden: !view.hidden }), view.hidden ? t("studioRemote.gachaShown") : t("studioRemote.gachaHidden"))}
        >
          {view.hidden ? t("studioRemote.screenHidden") : t("studioRemote.screenShown")}
        </button>
      </div>

      {s && (
        <div className={remote.rouletteStage} data-status={s.status}>
          <strong>
            {s.status === "SPINNING" && <span className={styles.liveDot} aria-hidden="true" />}
            {s.prize === null ? t("studioRemote.drawing") : s.blank ? t("studioRemote.blank") : t("studioRemote.won", { prize: s.prize })} · {s.donor}
          </strong>
          <span className={styles.muted}>
            {s.gachaName} · {formatNumber(s.amount)} FN · {s.no}
          </span>
          {s.status === "RESULT" && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => finishGachaDraw({ drawId: s.id }), t("studioRemote.resultCleared"))}>
              {t("studioRemote.done")}
            </button>
          )}
        </div>
      )}

      {view.queue.length === 0 && view.recent.length === 0 ? (
        <p className={styles.empty}>{t("studioRemote.gachaEmpty")}</p>
      ) : (
        <ul className={styles.list}>
          {view.queue.map((r, i) => (
            <Row key={r.id} row={r} meta={t("studioRemote.gachaQueueMeta", { n: i + 1, time: time(r.createdAt) })} pending={pending} run={run} />
          ))}
          {view.recent.map((r) => (
            <Row key={r.id} row={r} meta={r.blank ? t("studioRemote.blank") : t("studioRemote.won", { prize: String(r.prize) })} pending={pending} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ row, meta, pending, run }: { row: GachaRow; meta: string; pending: boolean; run: (action: () => Promise<GachaControlResult>, ok?: string) => void }) {
  const { t } = useI18n();
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {row.donor} · {row.gachaName} · {formatNumber(row.amount)} FN
        </span>
        <span className={styles.muted}>
          {row.no} · {meta}
        </span>
      </div>
      <span className={remote.statusTag} data-status={row.status === "QUEUED" ? "QUEUED" : "DONE"}>
        {t(STATUS_KEY[row.status])}
      </span>
      {row.claimed !== null && (
        <button
          type="button"
          className={row.claimed ? styles.ghost : styles.primary}
          aria-pressed={row.claimed}
          disabled={pending}
          onClick={() => run(() => setGachaClaimed({ drawId: row.id, claimed: !row.claimed }), row.claimed ? t("studioRemote.unclaimedSet") : t("studioRemote.claimedSet"))}
        >
          {row.claimed ? t("studioRemote.claimedDone") : t("studioRemote.markClaimed")}
        </button>
      )}
    </li>
  );
}
