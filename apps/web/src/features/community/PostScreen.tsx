"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment, deleteComment, deletePost } from "@/services/community/community";
import { COMMENT_MAX, categoryLabel, type PostDetail } from "@/services/community/communityTypes";
import styles from "./community.module.css";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

/** 게시글 상세 + 댓글 — code-first (no Figma frame). Route `/community/[id]`. */
export function PostScreen({ post, signedIn }: { post: PostDetail; signedIn: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ status: string; message?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.status === "SAVED") {
        after?.();
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push(`/login?next=/community/${post.id}`);
      else setError(res.message ?? "처리하지 못했어요.");
    });
  };

  return (
    <div className={styles.content}>
      <Link href="/community" className={styles.back}>
        ← 목록으로
      </Link>
      <article className={styles.card}>
        <header className={styles.postHead}>
          <span className={styles.chip}>{categoryLabel(post.category)}</span>
          <h1 className={styles.postTitle}>{post.title}</h1>
          <span className={styles.meta}>
            {post.authorName} · {when(post.createdAt)}
            {post.updatedAt ? " (수정됨)" : ""} · 조회 {post.views}
          </span>
        </header>
        <p className={styles.postBody}>{post.body}</p>
        {post.mine && (
          <div className={styles.actions}>
            <Link href={`/community/${post.id}/edit`} className={styles.ghost}>
              수정
            </Link>
            <button
              type="button"
              className={styles.danger}
              disabled={pending}
              onClick={() =>
                act(
                  () => deletePost(post.id),
                  () => router.push("/community")
                )
              }
            >
              삭제
            </button>
          </div>
        )}
      </article>

      <section className={styles.card} aria-labelledby="post-comments">
        <h2 id="post-comments" className={styles.cardTitle}>
          댓글 {post.comments.length}
        </h2>
        {post.comments.length === 0 ? (
          <p className={styles.meta}>첫 댓글을 남겨 보세요.</p>
        ) : (
          <ul className={styles.commentList}>
            {post.comments.map((c) => (
              <li key={c.id}>
                <span className={styles.meta}>
                  <strong>{c.authorName}</strong> · {when(c.createdAt)}
                </span>
                <p className={styles.commentBody}>{c.body}</p>
                {c.mine && (
                  <button type="button" className={styles.link} disabled={pending} onClick={() => act(() => deleteComment(post.id, c.id))}>
                    삭제
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {signedIn ? (
          <form
            className={styles.commentForm}
            onSubmit={(e) => {
              e.preventDefault();
              act(
                () => addComment(post.id, comment),
                () => setComment("")
              );
            }}
          >
            <input className={styles.input} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={COMMENT_MAX} placeholder="댓글을 입력해 주세요" aria-label="댓글" />
            <button type="submit" className={styles.primary} disabled={pending || !comment.trim()}>
              등록
            </button>
          </form>
        ) : (
          <Link href={`/login?next=/community/${post.id}`} className={styles.link}>
            로그인하고 댓글 남기기
          </Link>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
