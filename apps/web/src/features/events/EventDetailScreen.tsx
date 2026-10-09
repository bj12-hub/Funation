"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GENERIC_ERROR } from "@/features/mypage/editors/shared";
import { joinEvent } from "@/services/events/events";
import { PHASE_LABEL, eventPeriodLabel, eventRewardText, myEventResultText, type EventDetail } from "@/services/events/eventTypes";
import styles from "./events.module.css";

/**
 * 이벤트 상세 — code-first (no Figma frame). Route `/events/[id]`. The reward box shows the reward an operator set
 * (2026-10-08 결정), or the TBD note while none is set; after the event, the outcome and the viewer's own result.
 */
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
        {event.reward ? (
          <div className={styles.reward} aria-label="이벤트 보상">
            <strong className={styles.rewardTitle}>{eventRewardText(event.reward)}</strong>
            {event.reward.kind === "DRAW" && <span>경품: {event.reward.prize}</span>}
            <span>
              {event.reward.kind === "FREE_FN"
                ? "이벤트가 끝나면 참여자에게 지급돼요. 무상 FN은 환불되지 않아요."
                : "이벤트가 끝나면 추첨해요. 경품 전달 방법과 제세공과금 안내는 정해지면 알려 드려요 (TBD)."}
            </span>
          </div>
        ) : (
          <p className={styles.reward}>{event.rewardNote}</p>
        )}
        {event.outcome && (
          <div className={styles.outcome} role="status">
            <strong>{event.outcome.kind === "FREE_FN" ? "보상이 지급됐어요" : "당첨자를 발표했어요"}</strong>
            {event.outcome.kind === "DRAW" &&
              (event.outcome.winners.length > 0 ? (
                <ul className={styles.winners} aria-label="당첨자">
                  {event.outcome.winners.map((w, i) => (
                    <li key={`${i}-${w}`}>{w}</li>
                  ))}
                </ul>
              ) : (
                <span>당첨자가 없어요.</span>
              ))}
          </div>
        )}
        {event.joined ? (
          <>
            <p className={styles.joinedBox} role="status">
              ✓ 참여했어요
            </p>
            {event.myResult && (
              <p className={styles.myResult} data-tone={event.myResult.kind === "NOT_WON" || event.myResult.kind === "UNPAID" ? "muted" : "good"}>
                {myEventResultText(event.myResult)}
              </p>
            )}
          </>
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
