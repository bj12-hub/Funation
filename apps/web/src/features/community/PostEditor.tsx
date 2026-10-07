"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createPost, updatePost } from "@/services/community/community";
import { BOARD_CATEGORIES, BODY_MAX, TITLE_MAX, type BoardCategory } from "@/services/community/communityTypes";
import styles from "./community.module.css";

type Initial = { id: string; category: BoardCategory; title: string; body: string } | null;

/** 글쓰기 / 수정 — code-first (no Figma frame). Routes `/community/new`, `/community/[id]/edit`. */
export function PostEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [category, setCategory] = useState<BoardCategory>(initial?.category ?? "FREE");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 글쓰기: the same content after a failed or lost submit keeps its request id (one post); changed content gets a new one.
  const requestId = useRef<{ id: string; text: string } | null>(null);

  const submit = () => {
    setError(null);
    const input = { category, title, body };
    const text = JSON.stringify([category, title.trim(), body.trim()]);
    if (requestId.current?.text !== text) requestId.current = { id: crypto.randomUUID(), text };
    const id = requestId.current.id;
    startTransition(async () => {
      const res = initial ? await updatePost(initial.id, input) : await createPost({ ...input, requestId: id });
      if (res.status === "SAVED") {
        router.push(`/community/${res.id}`);
        router.refresh();
      } else if (res.status === "INVALID") setError(res.message);
      else if (res.status === "UNAUTHORIZED") router.push("/login?next=/community/new");
      else setError("이 글을 수정할 수 없어요.");
    });
  };

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>{initial ? "글 수정" : "글쓰기"}</h1>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className={styles.chips} role="radiogroup" aria-label="분류">
          {BOARD_CATEGORIES.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className={styles.chipButton} onClick={() => setCategory(c.key)}>
              {c.label}
            </button>
          ))}
        </div>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} placeholder="제목" aria-label="제목" />
        <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} placeholder="내용을 입력해 주세요." aria-label="내용" />
        <span className={styles.meta}>
          {body.length} / {BODY_MAX}
        </span>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={() => router.back()}>
            취소
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !title.trim() || !body.trim()} aria-busy={pending || undefined}>
            {pending ? "저장 중..." : initial ? "수정하기" : "등록하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
