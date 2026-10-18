"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QUEST_ACTION_LABEL } from "@/features/donations/questDecideText";
import { formatNumber } from "@/lib/format";
import { decideReceivedQuest } from "@/services/creator/donationManagement";
import { QUEST_STATUSES, type QuestStatus } from "@/services/creator/donationManagementTypes";
import { extendQuestTime } from "@/services/creator/questRemote";
import { QUEST_EXTEND_MINUTES, questExtendedLabel, type QuestAction, type QuestRemoteRow, type QuestRemoteView } from "@/services/donations/questTypes";
import styles from "../crew/crew.module.css";
import {
  QUEST_EXTEND_BUTTON,
  QUEST_EXTEND_DEFAULT_MINUTES,
  decideFromRemote,
  extendFromRemote,
  formatQuestAt,
  questExtendHint,
  questTimeLeft,
  type QuestRemoteNotice
} from "./questRemoteModel";
import remote from "./remote.module.css";

const statusLabel = (s: QuestStatus) => QUEST_STATUSES.find((x) => x.key === s)!.label;

/**
 * 리모컨 "퀘스트" card — code-first (funnation 기본값: 미션은 리모컨에서 확인). Lists the running quests with time left and
 * settles them with the actions, confirmation and server action of 후원관리+ › 받은 후원 › 퀘스트, which keeps working
 * as well. With the 퀘스트 위젯's 제한시간 연장 사용 on, each running quest also has 시간 연장 (2026-10-18 결정): minutes in
 * a small form under the row, then the browser's confirmation. The list comes with the 리모컨's refresh; a decided quest
 * leaves it on the next one.
 */
export function QuestRemote({ view }: { view: QuestRemoteView }) {
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
      }
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
      }
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
          🎯 퀘스트
        </h2>
        <Link href="/creator/widgets?open=QUEST" className={styles.ghost}>
          위젯 설정
        </Link>
      </div>
      <p className={styles.note}>
        성공은 크리에이터 몫이 되고, 실패 · 취소는 후원자에게 전액 환불돼요. 제한 시간이 지나도 결과를 정할 때까지 진행 중으로 남아요. 후원관리+ › 받은 후원 › 퀘스트에서도 정할 수 있어요.
      </p>
      <div className={remote.status}>
        <span>
          진행 중 {open.length}건{over > 0 ? ` · 시간 초과 ${over}건` : ""}
        </span>
        <span>보관 중 {formatNumber(held)} FN</span>
      </div>

      {notice && (
        <p className={notice.tone === "error" ? styles.error : styles.ok} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      {view.quests.length === 0 ? (
        <p className={styles.empty}>진행 중인 퀘스트가 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {view.quests.map((q) => {
            const left = questTimeLeft(q.endsAt, now);
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
                    {!done && !q.actions.includes("SUCCESS") && " · 성공 · 실패는 후원자가 정해요"}
                  </span>
                </div>
                {done ? (
                  <span className={remote.statusTag} data-status="DONE">
                    {statusLabel(done)}
                  </span>
                ) : (
                  <>
                    <span className={remote.statusTag} data-status={left.over ? "SHOWING" : "QUEUED"}>
                      {left.text}
                    </span>
                    {q.extendedMin > 0 && <span className={remote.statusTag}>{questExtendedLabel(q.extendedMin)}</span>}
                    {busy === q.id && (
                      <span className={styles.muted} role="status">
                        처리 중…
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
                        {QUEST_EXTEND_BUTTON}
                      </button>
                    )}
                    <span className={remote.buttons} role="group" aria-label={`${q.title} 결과 정하기`}>
                      {q.actions.map((a) => (
                        <button key={a} type="button" className={a === "SUCCESS" ? styles.primary : styles.danger} disabled={busy !== null} onClick={() => void decide(q, a)}>
                          {QUEST_ACTION_LABEL[a]}
                        </button>
                      ))}
                    </span>
                    {view.allowExtension && extending === q.id && (
                      <form
                        id={formId}
                        className={remote.extendForm}
                        aria-label={`${q.title} 시간 연장`}
                        onSubmit={(e) => {
                          e.preventDefault();
                          void extend(q);
                        }}
                      >
                        <label className={remote.extendField}>
                          연장할 시간
                          <input
                            className={styles.input}
                            type="number"
                            inputMode="numeric"
                            min={QUEST_EXTEND_MINUTES.min}
                            max={QUEST_EXTEND_MINUTES.max}
                            step={1}
                            aria-label="연장할 시간(분)"
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                          />
                          분
                        </label>
                        <button type="submit" className={styles.primary} disabled={busy !== null}>
                          연장하기
                        </button>
                        <button type="button" className={styles.ghost} onClick={() => setExtending(null)}>
                          닫기
                        </button>
                        <span className={styles.muted}>{questExtendHint(q, now)}</span>
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
