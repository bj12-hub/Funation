"use client";

import Link from "next/link";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { finishRouletteSpin, revealRouletteSpin, setRouletteHidden, setRoulettePaused, setRouletteSwitch, startNextSpin } from "@/services/creator/rouletteRemote";
import { isBlankPrize, type RouletteControlResult, type RouletteRemoteRow, type RouletteRemoteView, type RouletteSpinStatus } from "@/services/donations/rouletteTypes";
import styles from "../crew/crew.module.css";
import remote from "./remote.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
const resultText = (name: string, t: T) => (isBlankPrize(name) ? t("studioRemote.blank") : t("studioRemote.won", { prize: name }));
/** `ROULETTE_STATUS_LABEL` as message keys (2026-11-01). */
const STATUS_KEY: Record<RouletteSpinStatus, MessageKey> = {
  QUEUED: "studioRemote.rouletteQueued",
  SPINNING: "studioRemote.spinning",
  WAITING: "studioRemote.waitingResult",
  RESULT: "studioRemote.resultCheck",
  DONE: "studioRemote.statusDone"
};

/**
 * 리모컨 "룰렛" card — code-first (펀페이 1009:355 Web Remote 룰렛 제어). ▶ 시작 spins the oldest waiting
 * participation, Ⅱ 일시정지 holds 자동 시작, ✓ 결과 공개 shows a stopped wheel's result (결과 자동 노출 off),
 * ✓ 완료 takes a shown result off the screen, and the switches mirror 위젯 › 룰렛. Results are drawn by
 * the server at payment; the card shows a result only after the spin. Items and odds live on /creator/widgets.
 */
export function RouletteRemote({
  view,
  pending,
  run
}: {
  view: RouletteRemoteView;
  pending: boolean;
  run: (action: () => Promise<RouletteControlResult>, ok?: string) => void;
}) {
  const { t } = useI18n();
  const s = view.stage;
  const limit = (r: { nth: number }) =>
    view.dailyLimit > 0 ? t("studioRemote.rouletteToday", { nth: r.nth, limit: view.dailyLimit }) : t("studioRemote.rouletteTodayNth", { nth: r.nth });
  return (
    <section className={styles.card} aria-labelledby="roulette-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="roulette-remote">
          {t("studioRemote.rouletteTitle")}
        </h2>
        <Link href="/creator/widgets?open=ROULETTE" className={styles.ghost}>
          {t("studioRemote.rouletteSettings")}
        </Link>
      </div>
      <p className={styles.note}>{t("studioRemote.rouletteNote")}</p>

      <div className={remote.status}>
        <span>
          {t("studioRemote.rouletteStatus", { queue: view.queue.length, people: view.participantsToday })}
          {view.autoStart && view.paused ? t("studioRemote.rouletteAutoPaused") : ""}
        </span>
        <span>{view.items.map((it) => `${it.name} ${it.percent}%`).join(" · ")}</span>
      </div>

      {/* 펀페이 1009:355: 후원 받기 · 룰렛 자동시작 · 결과 자동노출 · 위젯 화면 숨기기 */}
      <div className={remote.buttons} role="group" aria-label={t("studioRemote.rouletteSwitches")}>
        {(
          [
            ["enabled", t("studioRemote.rouletteEnabled"), view.enabled],
            ["autoStart", t("studioRemote.rouletteAutoStart"), view.autoStart],
            ["autoReveal", t("studioRemote.rouletteAutoReveal"), view.autoReveal]
          ] as const
        ).map(([key, label, on]) => (
          <button
            key={key}
            type="button"
            className={on ? styles.chip : styles.chipOff}
            aria-pressed={on}
            disabled={pending}
            onClick={() => run(() => setRouletteSwitch({ key, on: !on }), t(on ? "studioRemote.switchOff" : "studioRemote.switchOn", { label }))}
          >
            {label} {on ? "ON" : "OFF"}
          </button>
        ))}
        <button
          type="button"
          className={view.hidden ? styles.chip : styles.chipOff}
          aria-pressed={view.hidden}
          disabled={pending}
          onClick={() => run(() => setRouletteHidden({ hidden: !view.hidden }), view.hidden ? t("studioRemote.rouletteShown") : t("studioRemote.rouletteHidden"))}
        >
          {view.hidden ? t("studioRemote.widgetScreenHidden") : t("studioRemote.widgetScreenShown")}
        </button>
      </div>

      {s && (
        <div className={remote.rouletteStage} data-status={s.status}>
          <strong>
            {s.status === "SPINNING" && <span className={styles.liveDot} aria-hidden="true" />}
            {s.status === "SPINNING" ? t("studioRemote.spinning") : s.status === "WAITING" ? t("studioRemote.waitingResult") : resultText(s.result ?? "", t)} · {s.donor}
          </strong>
          <span className={styles.muted}>
            {formatNumber(s.amount)} FN · {s.no}
          </span>
          {s.status === "WAITING" && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => revealRouletteSpin({ spinId: s.id }), t("studioRemote.revealed"))}>
              {t("studioRemote.reveal")}
            </button>
          )}
          {s.status === "RESULT" && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => finishRouletteSpin({ spinId: s.id }), t("studioRemote.resultCleared"))}>
              {t("studioRemote.done")}
            </button>
          )}
        </div>
      )}

      <div className={remote.buttons}>
        <button type="button" className={styles.primary} disabled={pending || s !== null || view.queue.length === 0} onClick={() => run(startNextSpin, t("studioRemote.spun"))}>
          {t("studioRemote.start")}
        </button>
        {view.autoStart && (
          <button
            type="button"
            className={view.paused ? styles.primary : styles.ghost}
            aria-pressed={view.paused}
            disabled={pending}
            onClick={() => run(() => setRoulettePaused({ paused: !view.paused }), view.paused ? t("studioRemote.autoStartResumed") : t("studioRemote.autoStartPaused"))}
          >
            {view.paused ? t("studioRemote.resumeAutoStart") : t("studioRemote.pause")}
          </button>
        )}
      </div>

      {view.queue.length === 0 && view.recent.length === 0 ? (
        <p className={styles.empty}>{t("studioRemote.rouletteEmpty")}</p>
      ) : (
        <ul className={styles.list}>
          {view.queue.map((r, i) => (
            <Row key={r.id} row={r} meta={t("studioRemote.rouletteQueueMeta", { n: i + 1, limit: limit(r), time: time(r.createdAt) })} />
          ))}
          {view.recent.map((r) => (
            <Row key={r.id} row={r} meta={`${limit(r)} · ${r.result ? resultText(r.result, t) : ""}`} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ row, meta }: { row: RouletteRemoteRow; meta: string }) {
  const { t } = useI18n();
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {row.donor} · {formatNumber(row.amount)} FN
        </span>
        <span className={styles.muted}>
          {row.no} · {meta}
        </span>
      </div>
      <span className={remote.statusTag} data-status={row.status === "QUEUED" ? "QUEUED" : "DONE"}>
        {t(STATUS_KEY[row.status])}
      </span>
    </li>
  );
}
