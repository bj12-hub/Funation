"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { submitInquiry } from "@/services/support/inquiry";
import { INQUIRY_BODY_MAX, INQUIRY_CATEGORIES, INQUIRY_TITLE_MAX, type FaqCategory } from "@/services/support/supportTypes";
import { FAQ_CATEGORY_KEY } from "./labels";
import styles from "./supportTabs.module.css";

/** 1:1 문의 form — code-first. The server validates; `requestId` keeps a double submit to one inquiry. */
export function InquiryForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [category, setCategory] = useState<FaqCategory | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  // After a failed or lost submit, retrying the same text keeps its request id (the server answers with the inquiry it
  // may already have), but an edit is a different inquiry: it gets a new id, so the edit is never dropped.
  const edited = () => {
    requestId.current = null;
  };

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
          setNote({ tone: "ok", text: t("support.submitted") });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/support%3Ftab%3Dinquiry");
        else setNote({ tone: "error", text: res.message });
      } catch {
        setNote({ tone: "error", text: t("support.submitError") });
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
        {t("support.formTitle")}
      </h2>
      <select
        className={styles.input}
        aria-label={t("support.type")}
        value={category}
        onChange={(e) => {
          edited();
          setCategory(e.target.value as FaqCategory | "");
        }}
      >
        <option value="">{t("support.typeSelect")}</option>
        {INQUIRY_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {t(FAQ_CATEGORY_KEY[c.key])}
          </option>
        ))}
      </select>
      <input
        className={styles.input}
        aria-label={t("support.titleLabel")}
        placeholder={t("support.titleLabel")}
        maxLength={INQUIRY_TITLE_MAX}
        value={title}
        onChange={(e) => {
          edited();
          setTitle(e.target.value);
        }}
      />
      <textarea
        className={styles.input}
        aria-label={t("support.body")}
        placeholder={t("support.bodyPlaceholder")}
        rows={6}
        maxLength={INQUIRY_BODY_MAX}
        value={body}
        onChange={(e) => {
          edited();
          setBody(e.target.value);
        }}
      />
      <div className={styles.formFoot}>
        <span className={styles.note}>
          {body.length}/{INQUIRY_BODY_MAX}
        </span>
        <button type="submit" className={styles.submit} disabled={pending || !category || !title.trim() || body.trim().length < 10}>
          {pending ? t("support.submitting") : t("support.submit")}
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
