"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { castVote, getRoomVote } from "@/services/votes/votes";
import { votePercent, type RoomVote } from "@/services/votes/voteTypes";
import styles from "./room.module.css";

const hms = (sec: number) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, "0")).join(":");

/**
 * 투표 card under the player — code-first (no Figma frame). Free (2026-10-04 결정): a signed-in viewer
 * picks an item and votes once; counts refresh every few seconds. Hidden while the channel has no vote
 * on screen. TBD: realtime push instead of polling.
 */
export function RoomVoteCard({ channelId, signedIn, initial }: { channelId: string; signedIn: boolean; initial: RoomVote | null }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [vote, setVote] = useState(initial);
  // The picked item belongs to one vote, so a new vote starts with nothing picked.
  const [pick, setPick] = useState<{ voteId: string; item: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const poll = setInterval(() => {
      getRoomVote(channelId)
        .then(setVote)
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(poll);
  }, [channelId]);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  if (!vote) return null;
  const choice = pick?.voteId === vote.id ? pick.item : null;
  const left = now === null ? null : Math.max(0, Math.floor((Date.parse(vote.endsAt) - now) / 1000));
  const ended = vote.ended || left === 0;
  const voted = vote.myChoice !== null;
  const canPick = signedIn && !voted && !ended;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (choice === null) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await castVote({ channelId, voteId: vote.id, item: choice });
        if (res.status === "VOTED" || res.status === "ALREADY_VOTED" || res.status === "ENDED") {
          setVote(res.vote);
          if (res.status === "ENDED") setError(t("room.voteEndedError"));
        } else if (res.status === "NOT_FOUND") {
          setError(t("room.voteChanged"));
          setVote(await getRoomVote(channelId));
        } else if (res.status === "INVALID") setError(res.message);
        else setError(t("room.voteLogin"));
      } catch {
        setError(t("room.voteFailed"));
      }
    });
  };

  return (
    <section className={styles.vote} style={{ borderColor: vote.color }} aria-labelledby="room-vote-title">
      <div className={styles.voteHead}>
        <h2 id="room-vote-title" className={styles.voteTitle}>
          📊 {vote.name}
        </h2>
        <span className={styles.voteMeta}>
          {ended ? t("room.voteClosed") : t("room.voteLeft", { time: left === null ? "--:--:--" : hms(left) })} · {t("room.voteTotal", { count: formatNumber(vote.total) })}
        </span>
      </div>
      <form onSubmit={submit} className={styles.voteForm}>
        <div className={styles.voteItems} role="radiogroup" aria-labelledby="room-vote-title">
          {vote.items.map((it, i) => {
            const pct = votePercent(it.count, vote.total);
            return (
              <label key={i} className={styles.voteItem} data-mine={vote.myChoice === i || undefined}>
                <span className={styles.voteFill} style={{ width: `${pct}%`, background: vote.color }} aria-hidden="true" />
                <input type="radio" name={`vote-${vote.id}`} value={i} checked={(voted ? vote.myChoice : choice) === i} disabled={!canPick} onChange={() => setPick({ voteId: vote.id, item: i })} />
                <span className={styles.voteLabel}>
                  {it.label}
                  {vote.myChoice === i && <span className={styles.voteMine}>{t("room.voteMine")}</span>}
                </span>
                <span className={styles.voteCount}>
                  {t("room.voteCount", { count: formatNumber(it.count) })} · {pct}%
                </span>
              </label>
            );
          })}
        </div>
        {!signedIn ? (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={styles.voteButton}>
            {t("room.voteLoginButton")}
          </Link>
        ) : voted ? (
          <p className={styles.voteNote}>{t("room.voted")}</p>
        ) : ended ? (
          <p className={styles.voteNote}>{t("room.voteOver")}</p>
        ) : (
          <>
            <button type="submit" className={styles.voteButton} disabled={choice === null || pending}>
              {pending ? t("room.voting") : t("room.voteSubmit")}
            </button>
            <p className={styles.voteNote}>{t("room.voteFinal")}</p>
          </>
        )}
        {error && (
          <p className={styles.voteError} role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
