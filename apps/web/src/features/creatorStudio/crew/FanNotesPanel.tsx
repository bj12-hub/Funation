"use client";

import { useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveFanNoteRules, setFanNotesOpen, setFanNoteStatus, simulateFanNote } from "@/services/crew/crewFanNotes";
import { FAN_NOTE_KINDS, FAN_NOTE_LIMITS, FAN_NOTE_RULE_RANGE, PLATFORM_FAN_NOTE_RULES, type BroadcastResult, type CrewMember, type FanNoteKind, type FanNoteStatus, type FanNotesView } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";
import local from "./fanNotes.module.css";

const STATUS_TABS: { key: FanNoteStatus | "ALL"; label: MessageKey }[] = [
  { key: "NEW", label: "crewOpsFanNotes.statusNew" },
  { key: "DONE", label: "crewOpsFanNotes.statusDone" },
  { key: "HIDDEN", label: "crewOpsFanNotes.statusHidden" },
  { key: "ALL", label: "crewOps.all" }
];
/** 종류 labels as message keys (FAN_NOTE_KINDS in crewTypes stays as written). */
const KIND_KEY: Record<FanNoteKind, MessageKey> = { MESSAGE: "crewOpsFanNotes.kindMessage", REQUEST: "crewOpsFanNotes.kindRequest" };
const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });

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
  const { t } = useI18n();
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
          {t("crewOpsFanNotes.title")} {view.counts.NEW > 0 && <span className={styles.chip}>{t("crewOpsFanNotes.newBadge", { count: view.counts.NEW })}</span>}
        </h2>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={view.open} disabled={pending} onChange={(e) => run(() => setFanNotesOpen({ broadcastId, on: e.target.checked }), e.target.checked ? t("crewOpsFanNotes.reopened") : t("crewOpsFanNotes.closed"))} />
          {t("crewOpsFanNotes.receive")}
        </label>
      </div>
      <p className={styles.note}>{t("crewOpsFanNotes.note", { max: FAN_NOTE_LIMITS.textMax })}</p>
      <form
        className={local.rules}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveFanNoteRules({ cooldownSec: num(cooldown), perBroadcast: num(cap) }), t("crewOpsFanNotes.rulesSaved"));
        }}
      >
        <span className={styles.muted}>{t("crewOpsFanNotes.spamRules")}</span>
        <label className={local.rule}>
          {t("crewOpsFanNotes.perPersonBefore")}
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={FAN_NOTE_RULE_RANGE.cooldownSec[0]}
            max={FAN_NOTE_RULE_RANGE.cooldownSec[1]}
            aria-label={t("crewOpsFanNotes.cooldownAria")}
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
          />
          {t("crewOpsFanNotes.perPersonAfter")}
        </label>
        <label className={local.rule}>
          {t("crewOpsFanNotes.perBroadcastBefore")}
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={FAN_NOTE_RULE_RANGE.perBroadcast[0]}
            max={FAN_NOTE_RULE_RANGE.perBroadcast[1]}
            aria-label={t("crewOpsFanNotes.capAria")}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
          {t("crewOpsFanNotes.perBroadcastAfter")}
        </label>
        <button type="submit" className={styles.ghost} disabled={pending}>
          {t("crewOps.save")}
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
          {t("crewOpsFanNotes.defaults", { sec: PLATFORM_FAN_NOTE_RULES.cooldownSec, count: formatNumber(PLATFORM_FAN_NOTE_RULES.perBroadcast) })}
        </button>
      </form>
      <p className={styles.note}>
        {t("crewOpsFanNotes.nowLine", {
          rule: view.rules.cooldownSec > 0 ? t("crewOpsFanNotes.onceEvery", { n: view.rules.cooldownSec }) : t("crewOpsFanNotes.noWait"),
          total: formatNumber(total),
          cap: formatNumber(view.rules.perBroadcast)
        })}
      </p>

      <div className={styles.rowActions}>
        {FAN_NOTE_KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={styles.ghost}
            disabled={pending}
            onClick={() => run(() => simulateFanNote({ broadcastId, kind: k.key, requestId: crypto.randomUUID() }), t("crewOpsFanNotes.testAdded", { kind: t(KIND_KEY[k.key]) }))}
          >
            {t("crewOpsFanNotes.test", { kind: t(KIND_KEY[k.key]) })}
          </button>
        ))}
      </div>

      <div className={local.filters}>
        <div className={styles.tabs} role="tablist" aria-label={t("crewOpsFanNotes.statusAria")}>
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} type="button" role="tab" aria-selected={status === tab.key} aria-current={status === tab.key ? "page" : undefined} className={styles.tab} onClick={() => setStatus(tab.key)}>
              {t(tab.label)} {tab.key === "ALL" ? total : view.counts[tab.key]}
            </button>
          ))}
        </div>
        <select className={styles.select} aria-label={t("crewOpsFanNotes.kindAria")} value={kind} onChange={(e) => setKind(e.target.value as FanNoteKind | "ALL")}>
          <option value="ALL">{t("crewOpsFanNotes.allKinds")}</option>
          {FAN_NOTE_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.emoji} {t(KIND_KEY[k.key])}
            </option>
          ))}
        </select>
        <select className={styles.select} aria-label={t("crewOpsFanNotes.memberAria")} value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="ALL">{t("crewOpsHistory.allMembers")}</option>
          <option value="CREW">{t("crewOpsFanNotes.toCrew")}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {total === 0 ? (
        <p className={styles.empty}>{view.open ? t("crewOpsFanNotes.emptyOpen") : t("crewOpsFanNotes.emptyClosed")}</p>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>{t("crewOpsFanNotes.emptyFiltered")}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((n) => {
            const k = FAN_NOTE_KINDS.find((x) => x.key === n.kind)!;
            return (
              <li key={n.id} className={styles.row} data-inactive={n.status === "NEW" ? undefined : ""}>
                <div className={`${styles.rowMain} ${local.main}`}>
                  <span className={styles.muted}>
                    <span className={n.kind === "REQUEST" ? styles.chip : styles.chipOff}>
                      {k.emoji} {t(KIND_KEY[k.key])}
                    </span>{" "}
                    {n.memberName ? `→ ${n.memberName}` : t("crewOpsFanNotes.toWholeCrew")} · {n.author} · {time(n.at)}
                    {n.status !== "NEW" && ` · ${n.status === "DONE" ? t("crewOpsFanNotes.statusDone") : t("crewOpsFanNotes.statusHidden")}`}
                  </span>
                  <span className={local.text}>{n.text}</span>
                </div>
                <div className={styles.rowActions}>
                  {n.status === "NEW" ? (
                    <>
                      <button type="button" className={styles.primary} disabled={pending} onClick={() => mark(n.id, "DONE")}>
                        {t("crewOpsFanNotes.markDone")}
                      </button>
                      <button type="button" className={styles.ghost} disabled={pending} onClick={() => mark(n.id, "HIDDEN")}>
                        {t("crewOpsFanNotes.hide")}
                      </button>
                    </>
                  ) : (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => mark(n.id, "NEW")}>
                      {t("crewOps.revert")}
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
