"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { decideReceivedQuest } from "@/services/creator/donationManagement";
import { extendQuestTime } from "@/services/creator/questRemote";
import { QUEST_EXTEND_MINUTES, type QuestAction, type QuestRemoteRow, type QuestRemoteView } from "@/services/donations/questTypes";
import styles from "../crew/crew.module.css";
import {
  QUEST_EXTEND_DEFAULT_MINUTES,
  decideFromRemote,
  extendFromRemote,
  formatQuestAt,
  questExtendHint,
  questTimeLeft,
  type QuestRemoteNotice
} from "./questRemoteModel";
import remote from "./remote.module.css";

/** The buttons (`QUEST_ACTION_LABEL`) and a decided quest's tag (`QUEST_STATUSES`), as message keys (2026-11-01). */
const ACTION_KEY: Record<QuestAction, MessageKey> = { SUCCESS: "studioRemote.questSuccess", FAILED: "studioRemote.questFailed", CANCELED: "studioRemote.questCanceled" };
const DECIDED_KEY: Record<QuestAction, MessageKey> = {
  SUCCESS: "studioRemote.questStatusSuccess",
  FAILED: "studioRemote.questStatusFailed",
  CANCELED: "studioRemote.questStatusCanceled"
};

/**
 * 리모컨 "퀘스트" card — code-first (funnation 기본값: 미션은 리모컨에서 확인). Lists the running quests with time left and
 * settles them with the actions, confirmation and server action of 후원관리+ › 받은 후원 › 퀘스트, which keeps working
 * as well. With the 퀘스트 위젯's 제한시간 연장 사용 on, each running quest also has 시간 연장 (2026-10-18 결정): minutes in
 * a small form under the row, then the browser's confirmation. The list comes with the 리모컨's refresh; a decided quest
 * leaves it on the next one.
 */
export function QuestRemote({ view }: { view: QuestRemoteView }) {
  const { t } = useI18n();
  const router = useRouter();
  // The server's clock first (the same text on the server and in the browser), then the browser's, every second.
  const [now, setNow] = useState(() => Date.parse(view.serverNow));
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const inFlight = useRef(new Set<string>());
  const pendingExtensions = useRef(new Map<string, { minutes: number; requestId: string }>());
  const [busy, setBusy] = useState<string | null>(null);
  const [decided, setDecided] = useState<Record<string, QuestAction>>({});
  const [notice, setNotice] = useState<QuestRemoteNotice | null>(null);
  // 시간 연장: the row whose form is open (one at a time) and its minutes as typed.
  const [extending, setExtending] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(QUEST_EXTEND_DEFAULT_MINUTES);

  const decide = async (row: QuestRemoteRow, outcome: QuestAction) => {
    const result = await decideFromRemote(row, outcome, {
      inFlight: inFlight.current,
      confirm: (message) => window.confirm(message),
      decide: decideReceivedQuest,
      onStart: () => {
        setBusy(row.id);
        setNotice(null);
      },
      t
    });
    setBusy((b) => (b === row.id ? null : b));
    if (result.kind === "SKIPPED") return;
    if (result.kind === "SIGN_IN") {
      router.push("/login?role=creator&next=/creator/remote");
      return;
    }
    setNotice(result.notice);
    if (result.kind === "DECIDED") setDecided((d) => ({ ...d, [row.id]: outcome }));
    if (result.kind === "DECIDED" || result.refresh) router.refresh();
  };

  const extend = async (row: QuestRemoteRow) => {
    const result = await extendFromRemote(row, minutes, Date.now(), {
      inFlight: inFlight.current,
      pending: pendingExtensions.current,
      newRequestId: () => crypto.randomUUID(),
      confirm: (message) => window.confirm(message),
      extend: extendQuestTime,
      onStart: () => {
        setBusy(row.id);
        setNotice(null);
      },
      t
    });
    setBusy((b) => (b === row.id ? null : b));
    if (result.kind === "SKIPPED") return;
    if (result.kind === "SIGN_IN") {
      router.push("/login?role=creator&next=/creator/remote");
      return;
    }
    setNotice(result.notice);
    if (result.kind === "EXTENDED") {
      setExtending(null);
      setMinutes(QUEST_EXTEND_DEFAULT_MINUTES);
    }
    if (result.kind === "EXTENDED" || result.refresh) router.refresh();
  };

  // A quest decided here stays in the list, marked, until the refresh drops it; it no longer counts.
  const open = view.quests.filter((q) => !decided[q.id]);
  const over = open.filter((q) => questTimeLeft(q.endsAt, now).over).length;
  const held = open.reduce((sum, q) => sum + q.amount, 0);

  return (
    <section className={styles.card} aria-labelledby="quest-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="quest-remote">
          {t("studioRemote.questTitle")}
        </h2>
        {/* With FLEXTV the settings are 후원 종류 설정 (phase 6). */}
        <Link href={FLEXTV_STUDIO ? "/creator/donation-types" : "/creator/widgets?open=QUEST"} className={styles.ghost}>
          {t("studioRemote.widgetSettings")}
        </Link>
      </div>
      <p className={styles.note}>{t("studioRemote.questNote")}</p>
      <div className={remote.status}>
        <span>
          {t("studioRemote.questRunning", { count: open.length })}
          {over > 0 ? t("studioRemote.questOverCount", { count: over }) : ""}
        </span>
        <span>{t("studioRemote.questHeld", { amount: formatNumber(held) })}</span>
      </div>

      {notice && (
        <p className={notice.tone === "error" ? styles.error : styles.ok} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      {view.quests.length === 0 ? (
        <p className={styles.empty}>{t("studioRemote.questEmpty")}</p>
      ) : (
        <ul className={styles.list}>
          {view.quests.map((q) => {
            const left = questTimeLeft(q.endsAt, now, t);
            const done = decided[q.id];
            const formId = `quest-extend-${q.id}`;
            return (
              <li key={q.id} className={styles.row} data-inactive={done ? "" : undefined}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {q.title} · {formatNumber(q.amount)} FN
                  </span>
                  <span className={styles.muted}>
                    {q.donor}
                    {q.donorId && ` (${q.donorId})`} · {formatQuestAt(q.createdAt)}
                    {!done && !q.actions.includes("SUCCESS") && t("studioRemote.questSupporterDecides")}
                  </span>
                </div>
                {done ? (
                  <span className={remote.statusTag} data-status="DONE">
                    {t(DECIDED_KEY[done])}
                  </span>
                ) : (
                  <>
                    <span className={remote.statusTag} data-status={left.over ? "SHOWING" : "QUEUED"}>
                      {left.text}
                    </span>
                    {q.extendedMin > 0 && <span className={remote.statusTag}>{t("studioRemote.questExtended", { minutes: q.extendedMin })}</span>}
                    {busy === q.id && (
                      <span className={styles.muted} role="status">
                        {t("studioRemote.processing")}
                      </span>
                    )}
                    {view.allowExtension && (
                      <button
                        type="button"
                        className={styles.ghost}
                        disabled={busy !== null}
                        aria-expanded={extending === q.id}
                        aria-controls={extending === q.id ? formId : undefined}
                        onClick={() => setExtending((x) => (x === q.id ? null : q.id))}
                      >
                        {t("studioRemote.questExtend")}
                      </button>
                    )}
                    <span className={remote.buttons} role="group" aria-label={t("studioRemote.questDecideAria", { title: q.title })}>
                      {q.actions.map((a) => (
                        <button key={a} type="button" className={a === "SUCCESS" ? styles.primary : styles.danger} disabled={busy !== null} onClick={() => void decide(q, a)}>
                          {t(ACTION_KEY[a])}
                        </button>
                      ))}
                    </span>
                    {view.allowExtension && extending === q.id && (
                      <form
                        id={formId}
                        className={remote.extendForm}
                        aria-label={t("studioRemote.questExtendAria", { title: q.title })}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void extend(q);
                        }}
                      >
                        <label className={remote.extendField}>
                          {t("studioRemote.extendLabel")}
                          <input
                            className={styles.input}
                            type="number"
                            inputMode="numeric"
                            min={QUEST_EXTEND_MINUTES.min}
                            max={QUEST_EXTEND_MINUTES.max}
                            step={1}
                            aria-label={t("studioRemote.extendMinutesAria")}
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                          />
                          {t("studioRemote.minutes")}
                        </label>
                        <button type="submit" className={styles.primary} disabled={busy !== null}>
                          {t("studioRemote.extendSubmit")}
                        </button>
                        <button type="button" className={styles.ghost} onClick={() => setExtending(null)}>
                          {t("studioRemote.close")}
                        </button>
                        <span className={styles.muted}>{questExtendHint(q, now, t)}</span>
                      </form>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
