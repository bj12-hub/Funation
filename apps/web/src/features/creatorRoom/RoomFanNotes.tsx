"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { getRoomFanNotes, sendFanNote } from "@/services/crew/crewFanNotes";
import { FAN_NOTE_KINDS, FAN_NOTE_LIMITS, type FanNoteKind, type RoomFanNotes } from "@/services/crew/crewTypes";
import styles from "./room.module.css";

const FAN_KIND_KEY: Record<FanNoteKind, MessageKey> = { MESSAGE: "room.fanKindMessage", REQUEST: "room.fanKindRequest" };

/**
 * 팬 메시지 · 요청사항 card under the player — code-first (funnation 엑셀방송, 2026-10-06 결정). Shown while the
 * channel's crew broadcast takes notes: a signed-in viewer sends a free note to one member or the whole crew and
 * sees whether the operator marked it 완료. Refreshes every few seconds (TBD: realtime push).
 */
export function RoomFanNotesCard({ channelId, signedIn, initial }: { channelId: string; signedIn: boolean; initial: RoomFanNotes | null }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [room, setRoom] = useState(initial);
  const [kind, setKind] = useState<FanNoteKind>("MESSAGE");
  const [memberId, setMemberId] = useState("");
  const [text, setText] = useState("");
  // The poll reads the draft without re-subscribing; a typed note keeps a closed card on screen.
  const draft = useRef("");
  const type = (value: string) => {
    draft.current = value;
    setText(value);
  };
  /** The broadcast stopped taking notes while this viewer had the card open (ended, or 받기 꺼짐). */
  const [closed, setClosed] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  // Cooldown end as a local timestamp; null until mounted (the clock is client-only).
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  const apply = (next: RoomFanNotes) => {
    setRoom(next);
    setClosed(false);
    setUntil(Date.now() + next.cooldownLeft * 1000);
  };
  const CLOSED_TEXT = t("room.fanClosed");

  useEffect(() => {
    setUntil(Date.now() + (initial?.cooldownLeft ?? 0) * 1000);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      getRoomFanNotes(channelId)
        .then((next) => {
          if (next) {
            setRoom(next);
            setClosed(false);
            setUntil(Date.now() + next.cooldownLeft * 1000);
          } else if (draft.current.trim()) setClosed(true);
          else setRoom(null);
        })
        .catch(() => undefined);
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [channelId, initial]);

  if (!room) return null;
  const left = now === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
  // A member who left the crew while picked falls back to 크루 전체.
  const target = room.members.some((m) => m.id === memberId) ? memberId : "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setNote(null);
    requestId.current ??= crypto.randomUUID();
    startTransition(async () => {
      try {
        const res = await sendFanNote({ channelId, broadcastId: room.broadcastId, kind, memberId: target || null, text, requestId: requestId.current });
        if (res.status === "SENT") {
          requestId.current = null;
          type("");
          apply(res.room);
          setNote({ tone: "ok", text: t("room.fanSent") });
        } else if (res.status === "COOLDOWN") {
          setUntil(Date.now() + res.seconds * 1000);
          setNote({ tone: "error", text: t("room.fanCooldownError", { sec: res.seconds }) });
        } else if (res.status === "CLOSED") {
          // Keep the card (and the typed text) with the reason instead of letting it vanish.
          requestId.current = null;
          setClosed(true);
          setNote({ tone: "error", text: CLOSED_TEXT });
        } else if (res.status === "INVALID") {
          requestId.current = null;
          setNote({ tone: "error", text: res.message });
        } else setNote({ tone: "error", text: t("room.fanLogin") });
      } catch {
        setNote({ tone: "error", text: t("room.fanFailed") });
      }
    });
  };

  return (
    <section className={styles.fan} aria-labelledby="room-fan-title">
      <div className={styles.voteHead}>
        <h2 id="room-fan-title" className={styles.voteTitle}>
          {t("room.fanTitle")}
        </h2>
        <span className={styles.voteMeta}>{t("room.fanMeta", { title: room.title })}</span>
      </div>
      {!signedIn ? (
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={styles.voteButton}>
          {t("room.fanLoginButton")}
        </Link>
      ) : (
        <form onSubmit={submit} className={styles.voteForm}>
          <div className={styles.fanRow}>
            <div className={styles.fanKinds} role="radiogroup" aria-label={t("room.fanKinds")}>
              {FAN_NOTE_KINDS.map((k) => (
                <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}>
                  {k.emoji} {t(FAN_KIND_KEY[k.key])}
                </button>
              ))}
            </div>
            <select className={styles.fanSelect} aria-label={t("room.fanMember")} value={target} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">{t("room.fanAllCrew")}</option>
              {room.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className={styles.fanText}
            aria-label={t("room.fanText")}
            placeholder={kind === "REQUEST" ? t("room.fanRequestPlaceholder") : t("room.fanMessagePlaceholder")}
            maxLength={FAN_NOTE_LIMITS.textMax}
            rows={2}
            value={text}
            onChange={(e) => type(e.target.value)}
          />
          <div className={styles.fanRow}>
            <span className={styles.voteNote}>
              {text.length}/{FAN_NOTE_LIMITS.textMax}
              {room.cooldownSec > 0 && ` · ${t("room.fanCooldown", { sec: room.cooldownSec })}`}
            </span>
            <button type="submit" className={`${styles.voteButton} ${styles.fanSend}`} disabled={pending || closed || left > 0 || !text.trim()}>
              {pending ? t("room.fanSending") : left > 0 ? t("room.fanWait", { sec: left }) : t("room.fanSend")}
            </button>
          </div>
          {note && (
            <p className={note.tone === "error" ? styles.voteError : styles.voteNote} role={note.tone === "error" ? "alert" : "status"}>
              {note.text}
            </p>
          )}
          {closed && (
            <div className={styles.fanRow}>
              {note?.text !== CLOSED_TEXT && (
                <p className={styles.voteError} role="alert">
                  {CLOSED_TEXT}
                </p>
              )}
              <button
                type="button"
                className={styles.voteNote}
                onClick={() => {
                  type("");
                  setNote(null);
                  setRoom(null);
                }}
              >
                {t("room.close")}
              </button>
            </div>
          )}
        </form>
      )}
      {room.mine.length > 0 && (
        <ul className={styles.fanMine} aria-label={t("room.fanMine")}>
          {room.mine.map((n) => (
            <li key={n.id}>
              <span className={styles.fanMineText}>
                {FAN_NOTE_KINDS.find((k) => k.key === n.kind)!.emoji} {n.memberName ? `${t("room.fanTo", { name: n.memberName })} · ` : ""}
                {n.text}
              </span>
              <span className={n.done ? styles.fanDone : styles.fanSent}>{n.done ? t("room.fanDone") : t("room.fanDelivered")}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
