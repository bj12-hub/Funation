"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
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
          if (res.status === "ENDED") setError("투표가 끝나서 참여하지 못했어요.");
        } else if (res.status === "NOT_FOUND") {
          setError("투표가 바뀌었어요. 새 투표를 확인해 주세요.");
          setVote(await getRoomVote(channelId));
        } else if (res.status === "INVALID") setError(res.message);
        else setError("로그인 후 투표할 수 있어요.");
      } catch {
        setError("투표하지 못했어요. 잠시 후 다시 시도해 주세요.");
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
          {ended ? "투표 종료" : `남은 시간 ${left === null ? "--:--:--" : hms(left)}`} · 총 {formatNumber(vote.total)}표
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
                  {vote.myChoice === i && <span className={styles.voteMine}>내 투표</span>}
                </span>
                <span className={styles.voteCount}>
                  {formatNumber(it.count)}표 · {pct}%
                </span>
              </label>
            );
          })}
        </div>
        {!signedIn ? (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={styles.voteButton}>
            로그인하고 투표하기
          </Link>
        ) : voted ? (
          <p className={styles.voteNote}>투표했어요. 투표는 한 번만 할 수 있어요.</p>
        ) : ended ? (
          <p className={styles.voteNote}>투표가 끝났어요.</p>
        ) : (
          <>
            <button type="submit" className={styles.voteButton} disabled={choice === null || pending}>
              {pending ? "투표하는 중…" : "투표하기 (무료)"}
            </button>
            <p className={styles.voteNote}>한 번 투표하면 바꿀 수 없어요.</p>
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
