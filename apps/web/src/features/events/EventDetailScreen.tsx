"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GENERIC_ERROR } from "@/features/mypage/editors/shared";
import { joinEvent } from "@/services/events/events";
import { PHASE_LABEL, eventPeriodLabel, type EventDetail } from "@/services/events/eventTypes";
import styles from "./events.module.css";

/** 이벤트 상세 — code-first (no Figma frame). Route `/events/[id]`. */
export function EventDetailScreen({ event, signedIn }: { event: EventDetail; signedIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const join = () => {
    if (!signedIn) return router.push(`/login?next=/events/${event.id}`);
    setError(null);
    startTransition(async () => {
      try {
        const res = await joinEvent(event.id);
        if (res.status === "JOINED") router.refresh();
        else if (res.status === "UNAUTHORIZED") router.push(`/login?next=/events/${event.id}`);
        else setError(res.status === "NOT_OPEN" ? "지금은 참여할 수 없는 이벤트예요." : "이벤트를 찾을 수 없어요.");
      } catch {
        // A failed request stays on this screen (joining again is idempotent on the server).
        setError(GENERIC_ERROR);
      }
    });
  };

  return (
    <div className={styles.content}>
      <Link href="/events" className={styles.back}>
        ← 이벤트 목록
      </Link>
      <article className={styles.detail}>
        <span className={styles.emojiLarge} aria-hidden="true">
          {event.emoji}
        </span>
        <span className={styles.phase} data-phase={event.phase}>
          {PHASE_LABEL[event.phase]}
        </span>
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.meta}>
          {eventPeriodLabel(event.startsAt, event.endsAt)} · 참여 {event.participants.toLocaleString("ko-KR")}명
        </p>
        <p className={styles.body}>{event.body}</p>
        <p className={styles.reward}>{event.rewardNote}</p>
        {event.joined ? (
          <p className={styles.joinedBox} role="status">
            ✓ 참여했어요
          </p>
        ) : (
          <button type="button" className={styles.primary} onClick={join} disabled={pending || event.phase !== "ongoing"} aria-busy={pending || undefined}>
            {event.phase === "upcoming" ? "곧 시작해요" : event.phase === "ended" ? "종료된 이벤트예요" : pending ? "참여 중..." : signedIn ? "참여하기" : "로그인하고 참여하기"}
          </button>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </article>
    </div>
  );
}
