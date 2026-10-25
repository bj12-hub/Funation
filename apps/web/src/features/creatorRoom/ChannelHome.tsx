"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatNumber, kstParts } from "@/lib/format";
import { createChannelPost, deleteChannelPost } from "@/services/creators/channelHome";
import { CHANNEL_POST_MAX, CHANNEL_POSTS_PAGE, type ChannelNews, type ChannelPost, type ChannelPostsView, type ChannelRanking } from "@/services/creators/channelTypes";
import { ModerationActions } from "../moderation/ModerationActions";
import styles from "./channel.module.css";

const when = (iso: string) => {
  const d = kstParts(iso);
  return `${d.month}.${d.day} ${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`;
};

/**
 * 채널 홈 아래: 월간 후원 랭킹 + 커뮤니티 최근 글 (funnation channel home, code-first). A FLEXTV channel's room (phase 9)
 * shows its 팬 랭킹 on FLEXTV — 팬 등급, no amounts — and its latest 소식 (`news`) instead.
 */
export function ChannelHomeExtras({ creatorId, ranking, posts, news }: { creatorId: string; ranking: ChannelRanking; posts: ChannelPost[]; news?: ChannelNews }) {
  const [y, m] = ranking.month.split("-");
  const flextv = ranking.source === "FLEXTV";
  return (
    <div className={styles.homeGrid}>
      <section className={styles.homeCard} aria-labelledby="ch-ranking">
        <h2 id="ch-ranking" className={styles.homeTitle}>
          🏆 {y}년 {Number(m)}월 {flextv ? "팬 랭킹" : "후원 랭킹"}
        </h2>
        {ranking.unavailable ? (
          <p className={styles.muted} role="status">
            랭킹을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
          </p>
        ) : ranking.rows.length === 0 ? (
          <p className={styles.muted}>이번 달 후원 기록이 아직 없어요.</p>
        ) : (
          <ol className={styles.rankList}>
            {ranking.rows.map((r) => (
              <li key={`${r.rank}-${r.name}`} className={styles.rankRow} data-me={r.me ? "" : undefined}>
                <span className={styles.rankNo} data-top={r.rank <= 3 ? "" : undefined}>
                  {r.rank}
                </span>
                <span className={styles.rankName}>
                  {r.name}
                  {r.me && <span className={styles.meBadge}>나</span>}
                </span>
                <span className={styles.rankAmount}>{r.fnAmount === null ? r.level || "팬" : `${formatNumber(r.fnAmount)} FN`}</span>
              </li>
            ))}
          </ol>
        )}
        <p className={styles.muted}>{flextv ? "FLEXTV 팬 랭킹 · 이번 달 후원 순 (금액은 보이지 않아요)" : "후원 금액 기준 (집계 기준 · 공개 여부 TBD)"}</p>
      </section>

      {news ? (
        <NewsCard creatorId={creatorId} news={news} />
      ) : (
        <section className={styles.homeCard} aria-labelledby="ch-posts">
          <div className={styles.homeHead}>
            <h2 id="ch-posts" className={styles.homeTitle}>
              💬 채널 커뮤니티
            </h2>
            <Link href={`/creators/${creatorId}?view=community`} className={styles.link} scroll={false}>
              전체 보기 ›
            </Link>
          </div>
          {posts.length === 0 ? (
            <p className={styles.muted}>아직 글이 없어요. 첫 글을 남겨 보세요.</p>
          ) : (
            <ul className={styles.postList}>
              {posts.map((p) => (
                <li key={p.id} className={styles.postPreview}>
                  <span className={styles.postBody}>{p.body}</span>
                  <span className={styles.muted}>
                    {p.authorName} · {when(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** A FLEXTV channel's latest 소식 on its room's 홈; each opens on FLEXTV, where its text and comments are. */
function NewsCard({ creatorId, news }: { creatorId: string; news: ChannelNews }) {
  return (
    <section className={styles.homeCard} aria-labelledby="ch-news">
      <div className={styles.homeHead}>
        <h2 id="ch-news" className={styles.homeTitle}>
          📣 방송국 소식
        </h2>
        <Link href={`/creators/${creatorId}?view=community`} className={styles.link} scroll={false}>
          전체 보기 ›
        </Link>
      </div>
      {news.unavailable ? (
        <p className={styles.muted} role="status">
          소식을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.
        </p>
      ) : news.items.length === 0 ? (
        <p className={styles.muted}>아직 소식이 없어요.</p>
      ) : (
        <ul className={styles.postList}>
          {news.items.map((n) => (
            <li key={n.id} className={styles.postPreview}>
              <a href={n.href} target="_blank" rel="noopener noreferrer" className={styles.postBody}>
                {n.important && <span className={styles.newsBadge}>필독</span>}
                {n.title || "제목 없는 소식"}
              </a>
              <span className={styles.muted}>
                {when(n.createdAt)} · 조회 {formatNumber(n.views)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 커뮤니티 탭 — the channel's own feed. Signed-in viewers post; authors delete their posts. */
export function ChannelCommunity({ creatorId, name, view, signedIn, show }: { creatorId: string; name: string; view: ChannelPostsView; signedIn: boolean; show: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // The same text after a failed or lost submit keeps its request id (one post); changed text gets a new one.
  const requestId = useRef<{ id: string; text: string } | null>(null);

  const submit = () => {
    const text = body.trim();
    if (requestId.current?.text !== text) requestId.current = { id: crypto.randomUUID(), text };
    const id = requestId.current.id;
    setNote(null);
    startTransition(async () => {
      try {
        const res = await createChannelPost({ creatorId, body, requestId: id });
        if (res.status === "SAVED") {
          requestId.current = null;
          setBody("");
          setNote({ tone: "ok", text: "글을 올렸어요." });
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : res.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : "올리지 못했어요." });
      } catch {
        setNote({ tone: "error", text: "올리지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const remove = (id: string) => {
    if (!window.confirm("이 글을 삭제할까요?")) return;
    startTransition(async () => {
      try {
        const res = await deleteChannelPost(id);
        setNote(res.status === "DELETED" ? { tone: "ok", text: "글을 삭제했어요." } : { tone: "error", text: "삭제하지 못했어요." });
        router.refresh();
      } catch {
        setNote({ tone: "error", text: "삭제하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className={styles.community}>
      {signedIn ? (
        <div className={styles.composer}>
          <textarea
            className={styles.textarea}
            aria-label={`${name} 채널에 글쓰기`}
            placeholder={`${name} 채널에 응원 글을 남겨 보세요`}
            maxLength={CHANNEL_POST_MAX}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className={styles.composerFoot}>
            <span className={styles.muted}>
              {body.length}/{CHANNEL_POST_MAX}
            </span>
            <button type="button" className={styles.donateButton} disabled={pending || !body.trim()} onClick={submit}>
              {pending ? "올리는 중…" : "올리기"}
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.muted}>
          글을 쓰려면 <Link href={`/login?next=/creators/${creatorId}?view=community`}>로그인</Link>해 주세요.
        </p>
      )}
      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      {view.items.length === 0 ? (
        <p className={styles.empty}>아직 글이 없어요.</p>
      ) : (
        <ul className={styles.postList}>
          {view.items.map((p) => (
            <li key={p.id} className={styles.post}>
              <div className={styles.postHead}>
                <strong>{p.authorName}</strong>
                <span className={styles.muted}>{when(p.createdAt)}</span>
                {p.mine ? (
                  <button type="button" className={styles.sort} disabled={pending} onClick={() => remove(p.id)}>
                    삭제
                  </button>
                ) : (
                  <ModerationActions target={{ type: "CHANNEL_POST", id: p.id }} signedIn={signedIn} className={styles.postModeration} />
                )}
              </div>
              <p className={styles.postText}>{p.body}</p>
            </li>
          ))}
        </ul>
      )}
      {view.hasMore && (
        <Link href={`/creators/${creatorId}?view=community&show=${show + CHANNEL_POSTS_PAGE}`} className={styles.link} scroll={false}>
          더 보기 ({view.items.length}/{view.total})
        </Link>
      )}
      <p className={styles.muted}>글마다 신고할 수 있어요. 채널 주인의 글 숨김 · 관리는 준비 중이에요 (TBD).</p>
    </div>
  );
}
