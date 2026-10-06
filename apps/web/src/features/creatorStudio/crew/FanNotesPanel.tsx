"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { saveFanNoteRules, setFanNotesOpen, setFanNoteStatus, simulateFanNote } from "@/services/crew/crewFanNotes";
import { FAN_NOTE_KINDS, FAN_NOTE_LIMITS, FAN_NOTE_RULE_RANGE, PLATFORM_FAN_NOTE_RULES, type BroadcastResult, type CrewMember, type FanNoteKind, type FanNoteStatus, type FanNotesView } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";
import local from "./fanNotes.module.css";

const STATUS_TABS: { key: FanNoteStatus | "ALL"; label: string }[] = [
  { key: "NEW", label: "처리 전" },
  { key: "DONE", label: "완료" },
  { key: "HIDDEN", label: "숨김" },
  { key: "ALL", label: "전체" }
];
const time = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

/**
 * 팬 메시지 · 요청사항 — code-first (funnation 엑셀방송, 2026-10-06 결정), inside `/creator/crew/broadcast` while live.
 * Viewers send them from the channel room; the operator filters by 종류 · 멤버 and marks each 완료 or hides it
 * (hidden notes still read "전달됨" to the sender). The screen's 5-second refresh brings new notes in. 도배 기준
 * (대기 시간 · 방송당 최대 개수) is the creator's, starting from the platform defaults (2026-10-06 결정).
 */
export function FanNotesPanel({
  broadcastId,
  members,
  view,
  pending,
  run
}: {
  broadcastId: string;
  members: CrewMember[];
  view: FanNotesView;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const [status, setStatus] = useState<FanNoteStatus | "ALL">("NEW");
  const [kind, setKind] = useState<FanNoteKind | "ALL">("ALL");
  const [member, setMember] = useState("ALL");
  const [cooldown, setCooldown] = useState(String(view.rules.cooldownSec));
  const [cap, setCap] = useState(String(view.rules.perBroadcast));
  // An empty box is not 0: the server rejects it with the allowed range.
  const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));
  const shown = view.notes.filter(
    (n) => (status === "ALL" || n.status === status) && (kind === "ALL" || n.kind === kind) && (member === "ALL" || (member === "CREW" ? n.memberId === null : n.memberId === member))
  );
  const total = view.counts.NEW + view.counts.DONE + view.counts.HIDDEN;
  const mark = (id: string, next: FanNoteStatus) => run(() => setFanNoteStatus({ broadcastId, id, status: next }));

  return (
    <section className={styles.card} aria-labelledby="bc-fan">
      <div className={styles.cardHead}>
        <h2 id="bc-fan" className={styles.cardTitle}>
          💌 팬 메시지 · 요청사항 {view.counts.NEW > 0 && <span className={styles.chip}>새 글 {view.counts.NEW}</span>}
        </h2>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={view.open} disabled={pending} onChange={(e) => run(() => setFanNotesOpen({ broadcastId, on: e.target.checked }), e.target.checked ? "방송 방에서 다시 받아요." : "방송 방 입력 칸을 닫았어요.")} />
          방송 방에서 받기
        </label>
      </div>
      <p className={styles.note}>
        시청자가 방송 방에서 무료로 {FAN_NOTE_LIMITS.textMax}자까지 보내요. 완료하면 보낸 사람에게 &lsquo;완료&rsquo;로 보이고, 숨긴 글은 &lsquo;전달됨&rsquo;으로 남아요.
      </p>
      <form
        className={local.rules}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveFanNoteRules({ cooldownSec: num(cooldown), perBroadcast: num(cap) }), "도배 기준을 저장했어요. 지금 방송부터 적용돼요.");
        }}
      >
        <span className={styles.muted}>도배 기준</span>
        <label className={local.rule}>
          한 사람당
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={FAN_NOTE_RULE_RANGE.cooldownSec[0]}
            max={FAN_NOTE_RULE_RANGE.cooldownSec[1]}
            aria-label="대기 시간(초)"
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
          />
          초에 한 번
        </label>
        <label className={local.rule}>
          방송당
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={FAN_NOTE_RULE_RANGE.perBroadcast[0]}
            max={FAN_NOTE_RULE_RANGE.perBroadcast[1]}
            aria-label="방송당 최대 개수"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
          개까지
        </label>
        <button type="submit" className={styles.ghost} disabled={pending}>
          저장
        </button>
        <button
          type="button"
          className={styles.ghost}
          disabled={pending}
          onClick={() => {
            setCooldown(String(PLATFORM_FAN_NOTE_RULES.cooldownSec));
            setCap(String(PLATFORM_FAN_NOTE_RULES.perBroadcast));
          }}
        >
          기본값({PLATFORM_FAN_NOTE_RULES.cooldownSec}초 · {formatNumber(PLATFORM_FAN_NOTE_RULES.perBroadcast)}개)
        </button>
      </form>
      <p className={styles.note}>
        지금 {view.rules.cooldownSec > 0 ? `${view.rules.cooldownSec}초에 한 번` : "대기 없이"} · 이번 방송 {formatNumber(total)}/{formatNumber(view.rules.perBroadcast)}개 받음. 0초로 두면 기다리지 않고
        보낼 수 있어요.
      </p>

      <div className={styles.rowActions}>
        {FAN_NOTE_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={styles.ghost}
            disabled={pending}
            onClick={() => run(() => simulateFanNote({ broadcastId, kind: k.key, requestId: crypto.randomUUID() }), `테스트 ${k.label}를 넣었어요.`)}
          >
            테스트 {k.label}
          </button>
        ))}
      </div>

      <div className={local.filters}>
        <div className={styles.tabs} role="tablist" aria-label="처리 상태">
          {STATUS_TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={status === t.key} aria-current={status === t.key ? "page" : undefined} className={styles.tab} onClick={() => setStatus(t.key)}>
              {t.label} {t.key === "ALL" ? total : view.counts[t.key]}
            </button>
          ))}
        </div>
        <select className={styles.select} aria-label="종류" value={kind} onChange={(e) => setKind(e.target.value as FanNoteKind | "ALL")}>
          <option value="ALL">모든 종류</option>
          {FAN_NOTE_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.emoji} {k.label}
            </option>
          ))}
        </select>
        <select className={styles.select} aria-label="받는 멤버" value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="ALL">모든 멤버</option>
          <option value="CREW">크루 전체에게</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {total === 0 ? (
        <p className={styles.empty}>{view.open ? "아직 받은 글이 없어요. 방송 방에 입력 칸이 열려 있어요." : "방송 방에서 받기가 꺼져 있어요."}</p>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>조건에 맞는 글이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((n) => {
            const k = FAN_NOTE_KINDS.find((x) => x.key === n.kind)!;
            return (
              <li key={n.id} className={styles.row} data-inactive={n.status === "NEW" ? undefined : ""}>
                <div className={`${styles.rowMain} ${local.main}`}>
                  <span className={styles.muted}>
                    <span className={n.kind === "REQUEST" ? styles.chip : styles.chipOff}>
                      {k.emoji} {k.label}
                    </span>{" "}
                    {n.memberName ? `→ ${n.memberName}` : "→ 크루 전체"} · {n.author} · {time(n.at)}
                    {n.status !== "NEW" && ` · ${n.status === "DONE" ? "완료" : "숨김"}`}
                  </span>
                  <span className={local.text}>{n.text}</span>
                </div>
                <div className={styles.rowActions}>
                  {n.status === "NEW" ? (
                    <>
                      <button type="button" className={styles.primary} disabled={pending} onClick={() => mark(n.id, "DONE")}>
                        완료
                      </button>
                      <button type="button" className={styles.ghost} disabled={pending} onClick={() => mark(n.id, "HIDDEN")}>
                        숨기기
                      </button>
                    </>
                  ) : (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => mark(n.id, "NEW")}>
                      되돌리기
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
