"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { submitInquiry } from "@/services/support/inquiry";
import { INQUIRY_BODY_MAX, INQUIRY_CATEGORIES, INQUIRY_TITLE_MAX, type FaqCategory } from "@/services/support/supportTypes";
import styles from "./supportTabs.module.css";

/** 1:1 문의 form — code-first. The server validates; `requestId` keeps a double submit to one inquiry. */
export function InquiryForm() {
  const router = useRouter();
  const [category, setCategory] = useState<FaqCategory | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const submit = () => {
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    setNote(null);
    startTransition(async () => {
      try {
        const res = await submitInquiry({ requestId: id, category, title, body });
        if (res.status === "SUBMITTED") {
          requestId.current = null;
          setCategory("");
          setTitle("");
          setBody("");
          setNote({ tone: "ok", text: "문의가 접수되었어요. 답변은 내 문의 내역에서 확인할 수 있어요." });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/support%3Ftab%3Dinquiry");
        else setNote({ tone: "error", text: res.message });
      } catch {
        setNote({ tone: "error", text: "접수하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <form
      className={styles.form}
      aria-labelledby="inquiry-title"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 id="inquiry-title" className={styles.formTitle}>
        문의하기
      </h2>
      <select className={styles.input} aria-label="문의 유형" value={category} onChange={(e) => setCategory(e.target.value as FaqCategory | "")}>
        <option value="">문의 유형 선택</option>
        {INQUIRY_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
      <input className={styles.input} aria-label="제목" placeholder="제목" maxLength={INQUIRY_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={styles.input} aria-label="내용" placeholder="문의 내용을 자세히 적어 주세요 (10자 이상)" rows={6} maxLength={INQUIRY_BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className={styles.formFoot}>
        <span className={styles.note}>
          {body.length}/{INQUIRY_BODY_MAX}
        </span>
        <button type="submit" className={styles.submit} disabled={pending || !category || !title.trim() || body.trim().length < 10}>
          {pending ? "접수 중…" : "문의 접수"}
        </button>
      </div>
      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </form>
  );
}
