"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { joinEvent } from "@/services/events/events";
import { eventPeriodLabel, type EventDetail } from "@/services/events/eventTypes";
import { PHASE_KEY } from "./labels";
import styles from "./events.module.css";

/** The viewer's own result line (Korean as myEventResultText; PAID carries its amount). */
const RESULT_KEY = { WON: "events.resultWon", NOT_WON: "events.resultNotWon", UNPAID: "events.resultUnpaid" } as const;

/**
 * 이벤트 상세 — code-first (no Figma frame). Route `/events/[id]`. The reward box shows the reward an operator set
 * (2026-10-08 결정), or the TBD note while none is set; after the event, the outcome and the viewer's own result.
 */
export function EventDetailScreen({ event, signedIn }: { event: EventDetail; signedIn: boolean }) {
  const { t } = useI18n();
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
        else setError(res.status === "NOT_OPEN" ? t("events.notOpen") : t("events.notFound"));
      } catch {
        // A failed request stays on this screen (joining again is idempotent on the server).
        setError(t("page.errorDescription"));
      }
    });
  };

  return (
    <div className={styles.content}>
      <Link href="/events" className={styles.back}>
        {t("events.back")}
      </Link>
      <article className={styles.detail}>
        <span className={styles.emojiLarge} aria-hidden="true">
          {event.emoji}
        </span>
        <span className={styles.phase} data-phase={event.phase}>
          {t(PHASE_KEY[event.phase])}
        </span>
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.meta}>
          {eventPeriodLabel(event.startsAt, event.endsAt)} · {t("events.participants", { count: event.participants.toLocaleString("ko-KR") })}
        </p>
        <p className={styles.body}>{event.body}</p>
        {event.reward ? (
          <div className={styles.reward} aria-label={t("events.reward")}>
            <strong className={styles.rewardTitle}>
              {event.reward.kind === "FREE_FN"
                ? t("events.rewardFreeFn", { amount: event.reward.amountFn.toLocaleString("ko-KR") })
                : t("events.rewardDraw", { count: event.reward.winners.toLocaleString("ko-KR") })}
            </strong>
            {event.reward.kind === "DRAW" && <span>{t("events.prize", { prize: event.reward.prize })}</span>}
            <span>
              {event.reward.kind === "FREE_FN"
                ? t("events.freeFnNote")
                : t("events.drawNote")}
            </span>
          </div>
        ) : (
          <p className={styles.reward}>{event.rewardNote}</p>
        )}
        {event.outcome && (
          <div className={styles.outcome} role="status">
            <strong>{event.outcome.kind === "FREE_FN" ? t("events.paidOut") : t("events.announced")}</strong>
            {event.outcome.kind === "DRAW" &&
              (event.outcome.winners.length > 0 ? (
                <ul className={styles.winners} aria-label={t("events.winners")}>
                  {event.outcome.winners.map((w, i) => (
                    <li key={`${i}-${w}`}>{w}</li>
                  ))}
                </ul>
              ) : (
                <span>{t("events.noWinners")}</span>
              ))}
          </div>
        )}
        {event.joined ? (
          <>
            <p className={styles.joinedBox} role="status">
              {t("events.joinedBox")}
            </p>
            {event.myResult && (
              <p className={styles.myResult} data-tone={event.myResult.kind === "NOT_WON" || event.myResult.kind === "UNPAID" ? "muted" : "good"}>
                {event.myResult.kind === "PAID"
                  ? t("events.resultPaid", { amount: event.myResult.amountFn.toLocaleString("ko-KR") })
                  : t(RESULT_KEY[event.myResult.kind])}
              </p>
            )}
          </>
        ) : (
          <button type="button" className={styles.primary} onClick={join} disabled={pending || event.phase !== "ongoing"} aria-busy={pending || undefined}>
            {event.phase === "upcoming" ? t("events.startsSoon") : event.phase === "ended" ? t("events.endedButton") : pending ? t("events.joining") : signedIn ? t("events.join") : t("events.loginToJoin")}
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
