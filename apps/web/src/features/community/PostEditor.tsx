"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createPost, updatePost } from "@/services/community/community";
import { BOARD_CATEGORIES, BODY_MAX, TITLE_MAX, type BoardCategory } from "@/services/community/communityTypes";
import { BOARD_CATEGORY_KEY } from "./labels";
import styles from "./community.module.css";

type Initial = { id: string; category: BoardCategory; title: string; body: string } | null;

/** 글쓰기 / 수정 — code-first (no Figma frame). Routes `/community/new`, `/community/[id]/edit`. */
export function PostEditor({ initial }: { initial: Initial }) {
  const { t } = useI18n();
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
      try {
        const res = initial ? await updatePost(initial.id, input) : await createPost({ ...input, requestId: id });
        if (res.status === "SAVED") {
          router.push(`/community/${res.id}`);
          router.refresh();
        } else if (res.status === "INVALID") setError(res.message);
        // Signed out meanwhile: back to this editor after signing in.
        else if (res.status === "UNAUTHORIZED") router.push(`/login?next=${initial ? `/community/${initial.id}/edit` : "/community/new"}`);
        else setError(t("community.cannotEdit"));
      } catch {
        // The request failed (network / server): what was typed stays for another try.
        setError(t("page.errorDescription"));
      }
    });
  };

  return (
    <div className={styles.content}>
      <h1 className={styles.title}>{initial ? t("community.editPost") : t("community.newPost")}</h1>
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className={styles.chips} role="radiogroup" aria-label={t("community.category")}>
          {BOARD_CATEGORIES.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className={styles.chipButton} onClick={() => setCategory(c.key)}>
              {t(BOARD_CATEGORY_KEY[c.key])}
            </button>
          ))}
        </div>
        <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} placeholder={t("community.titleLabel")} aria-label={t("community.titleLabel")} />
        <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} placeholder={t("community.bodyPlaceholder")} aria-label={t("community.body")} />
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
            {t("community.cancel")}
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !title.trim() || !body.trim()} aria-busy={pending || undefined}>
            {pending ? t("community.saving") : initial ? t("community.update") : t("community.publish")}
          </button>
        </div>
      </form>
    </div>
  );
}
