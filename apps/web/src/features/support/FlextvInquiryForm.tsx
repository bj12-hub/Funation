"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FLEXTV_INQUIRY_BODY_MAX, FLEXTV_INQUIRY_IMAGE_MAX_BYTES, FLEXTV_INQUIRY_IMAGE_TYPES, FLEXTV_INQUIRY_TITLE_MAX } from "@/lib/flextv/rules";
import { submitFlextvInquiry } from "@/services/support/inquiry";
import styles from "./supportTabs.module.css";

/** FLEXTV's 유형 5: its form shows its 휴대폰 결제 환불 안내 under it (FLEXTV's PostForm), and so does this one. */
const REFUND_CATEGORY = "5";

/**
 * 1:1 문의 with FLEXTV (phase 9; code-first, FLEXTV's own 1:1 문의 form is the reference): FLEXTV's 유형, 제목 (50자),
 * 내용 (1000자) and one PNG · JPG picture. The server checks everything again; `requestId` keeps a double submit to one
 * 문의.
 */
export function FlextvInquiryForm({ categories }: { categories: { value: string; label: string }[] }) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef<string | null>(null);
  // After a failed or lost submit, retrying the same 문의 keeps its request id; an edit is a different 문의.
  const edited = () => {
    requestId.current = null;
  };

  const pick = (file: File | undefined) => {
    edited();
    if (!file) return setImage(null);
    if (!(FLEXTV_INQUIRY_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > FLEXTV_INQUIRY_IMAGE_MAX_BYTES) {
      setNote({ tone: "error", text: "첨부 사진은 20MB 미만의 PNG, JPG 이미지만 올릴 수 있어요." });
      if (fileInput.current) fileInput.current.value = "";
      return setImage(null);
    }
    setNote(null);
    setImage(file);
  };

  const submit = () => {
    requestId.current ??= crypto.randomUUID();
    const form = new FormData();
    form.set("requestId", requestId.current);
    form.set("category", category);
    form.set("title", title);
    form.set("content", body);
    if (image) form.set("image", image);
    setNote(null);
    startTransition(async () => {
      try {
        const res = await submitFlextvInquiry(form);
        if (res.status === "SUBMITTED") {
          requestId.current = null;
          setCategory("");
          setTitle("");
          setBody("");
          setImage(null);
          if (fileInput.current) fileInput.current.value = "";
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
      <select
        className={styles.input}
        aria-label="문의 유형"
        value={category}
        onChange={(e) => {
          edited();
          setCategory(e.target.value);
        }}
      >
        <option value="">문의 유형 선택</option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        className={styles.input}
        aria-label="제목"
        placeholder="제목"
        maxLength={FLEXTV_INQUIRY_TITLE_MAX}
        value={title}
        onChange={(e) => {
          edited();
          setTitle(e.target.value);
        }}
      />
      <textarea
        className={styles.input}
        aria-label="내용"
        placeholder="문의 내용을 자세히 적어 주세요"
        rows={6}
        maxLength={FLEXTV_INQUIRY_BODY_MAX}
        value={body}
        onChange={(e) => {
          edited();
          setBody(e.target.value);
        }}
      />
      <div className={styles.attach}>
        <label className={styles.attachButton}>
          사진 첨부
          <input ref={fileInput} type="file" accept={FLEXTV_INQUIRY_IMAGE_TYPES.join(",")} className={styles.srOnly} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {image ? (
          <>
            <span className={styles.note}>{image.name}</span>
            <button
              type="button"
              className={styles.attachRemove}
              onClick={() => {
                pick(undefined);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              빼기
            </button>
          </>
        ) : (
          <span className={styles.note}>PNG, JPG · 20MB 미만 · 1장</span>
        )}
      </div>
      {category === REFUND_CATEGORY && (
        <ul className={styles.refundNote} aria-label="결제 · 환불 안내">
          <li>휴대폰 결제의 경우, 당월은 결제 취소만 가능합니다.</li>
          <li>익월 이후 환불 요청 시, 휴대폰 요금 납부 확인 후 결제자 본인 계좌로만 환불 가능합니다.</li>
        </ul>
      )}
      <div className={styles.formFoot}>
        <span className={styles.note}>
          {body.length}/{FLEXTV_INQUIRY_BODY_MAX}
        </span>
        <button type="submit" className={styles.submit} disabled={pending || !category || !title.trim() || !body.trim()}>
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
