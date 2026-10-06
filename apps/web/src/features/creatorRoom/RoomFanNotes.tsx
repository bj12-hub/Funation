"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { getRoomFanNotes, sendFanNote } from "@/services/crew/crewFanNotes";
import { FAN_NOTE_KINDS, FAN_NOTE_LIMITS, type FanNoteKind, type RoomFanNotes } from "@/services/crew/crewTypes";
import styles from "./room.module.css";

/**
 * 팬 메시지 · 요청사항 card under the player — code-first (funnation 엑셀방송, 2026-10-06 결정). Shown while the
 * channel's crew broadcast takes notes: a signed-in viewer sends a free note to one member or the whole crew and
 * sees whether the operator marked it 완료. Refreshes every few seconds (TBD: realtime push).
 */
export function RoomFanNotesCard({ channelId, signedIn, initial }: { channelId: string; signedIn: boolean; initial: RoomFanNotes | null }) {
  const pathname = usePathname();
  const [room, setRoom] = useState(initial);
  const [kind, setKind] = useState<FanNoteKind>("MESSAGE");
  const [memberId, setMemberId] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  // Cooldown end as a local timestamp; null until mounted (the clock is client-only).
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  const apply = (next: RoomFanNotes | null) => {
    setRoom(next);
    setUntil(next ? Date.now() + next.cooldownLeft * 1000 : 0);
  };

  useEffect(() => {
    setUntil(Date.now() + (initial?.cooldownLeft ?? 0) * 1000);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      getRoomFanNotes(channelId)
        .then((next) => {
          setRoom(next);
          setUntil(next ? Date.now() + next.cooldownLeft * 1000 : 0);
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
          setText("");
          apply(res.room);
          setNote({ tone: "ok", text: "전달했어요. 처리되면 아래에 완료로 표시돼요." });
        } else if (res.status === "COOLDOWN") {
          setUntil(Date.now() + res.seconds * 1000);
          setNote({ tone: "error", text: `${res.seconds}초 뒤에 다시 보낼 수 있어요.` });
        } else if (res.status === "CLOSED") {
          requestId.current = null;
          apply(await getRoomFanNotes(channelId));
          setNote({ tone: "error", text: "지금은 메시지를 받지 않아요." });
        } else if (res.status === "INVALID") {
          requestId.current = null;
          setNote({ tone: "error", text: res.message });
        } else setNote({ tone: "error", text: "로그인 후 보낼 수 있어요." });
      } catch {
        setNote({ tone: "error", text: "보내지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <section className={styles.fan} aria-labelledby="room-fan-title">
      <div className={styles.voteHead}>
        <h2 id="room-fan-title" className={styles.voteTitle}>
          💌 팬 메시지 · 요청사항
        </h2>
        <span className={styles.voteMeta}>{room.title} · 진행 중 · 무료</span>
      </div>
      {!signedIn ? (
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={styles.voteButton}>
          로그인하고 남기기
        </Link>
      ) : (
        <form onSubmit={submit} className={styles.voteForm}>
          <div className={styles.fanRow}>
            <div className={styles.fanKinds} role="radiogroup" aria-label="보낼 종류">
              {FAN_NOTE_KINDS.map((k) => (
                <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}>
                  {k.emoji} {k.label}
                </button>
              ))}
            </div>
            <select className={styles.fanSelect} aria-label="받는 멤버" value={target} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">크루 전체</option>
              {room.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className={styles.fanText}
            aria-label="내용"
            placeholder={kind === "REQUEST" ? "노래 · 미션 같은 요청을 적어 주세요." : "멤버에게 응원 한마디를 남겨 주세요."}
            maxLength={FAN_NOTE_LIMITS.textMax}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className={styles.fanRow}>
            <span className={styles.voteNote}>
              {text.length}/{FAN_NOTE_LIMITS.textMax} · {FAN_NOTE_LIMITS.cooldownSec}초에 한 번
            </span>
            <button type="submit" className={`${styles.voteButton} ${styles.fanSend}`} disabled={pending || left > 0 || !text.trim()}>
              {pending ? "보내는 중…" : left > 0 ? `${left}초 뒤에 보내기` : "보내기 (무료)"}
            </button>
          </div>
          {note && (
            <p className={note.tone === "error" ? styles.voteError : styles.voteNote} role={note.tone === "error" ? "alert" : "status"}>
              {note.text}
            </p>
          )}
        </form>
      )}
      {room.mine.length > 0 && (
        <ul className={styles.fanMine} aria-label="내가 보낸 글">
          {room.mine.map((n) => (
            <li key={n.id}>
              <span className={styles.fanMineText}>
                {FAN_NOTE_KINDS.find((k) => k.key === n.kind)!.emoji} {n.memberName ? `${n.memberName}에게 · ` : ""}
                {n.text}
              </span>
              <span className={n.done ? styles.fanDone : styles.fanSent}>{n.done ? "완료" : "전달됨"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
