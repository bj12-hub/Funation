"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, FileImageIcon, UploadIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { uploadProfilePhoto } from "@/services/account/profileActions";
import { formatMegabytes } from "./shared";
import styles from "./editors.module.css";

/**
 * Profile photo change. Figma: base 743:1978 · unsupported 745:52 · too large 745:98
 * · upload failed 745:190 · success 745:236
 *
 * Figma conflict: the base hint lists "JPG, PNG" while 745:52 lists "JPG, PNG, WEBP".
 * WEBP is accepted (flagged in the PR). The file is re-checked on the server.
 */

type Failure = "UNSUPPORTED" | "TOO_LARGE" | "FAILED";

const FAILURES: Record<Failure, { title: MessageKey; headline: MessageKey; sub: MessageKey; retry: MessageKey; showType: boolean }> = {
  UNSUPPORTED: {
    title: "myEdit.photoUnsupportedTitle",
    headline: "myEdit.photoUnsupported",
    sub: "myEdit.photoUnsupportedHint",
    retry: "myEdit.photoPickAnother",
    showType: true
  },
  TOO_LARGE: {
    title: "myEdit.photoTooLargeTitle",
    headline: "myEdit.photoTooLarge",
    sub: "myEdit.photoTooLargeHint",
    retry: "myEdit.photoPickAgain",
    showType: false
  },
  FAILED: {
    title: "myEdit.photoFailedTitle",
    headline: "myEdit.photoFailed",
    sub: "myEdit.photoFailedHint",
    retry: "my.retry",
    showType: false
  }
};

type Props = { triggerClassName: string; currentUrl: string | null; nickname: string };

export function PhotoEditor({ triggerClassName, currentUrl, nickname }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Release object URLs created for previews.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function reset() {
    setFile(null);
    setPreview(null);
    setFailure(null);
    setDone(false);
  }

  function pick(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setDone(false);
    if (!(PROFILE_PHOTO_TYPES as readonly string[]).includes(selected.type)) return setFailure("UNSUPPORTED");
    if (selected.size > PROFILE_PHOTO_MAX_BYTES) return setFailure("TOO_LARGE");
    setFailure(null);
    setPreview(URL.createObjectURL(selected));
  }

  async function save() {
    if (!file) return inputRef.current?.click();
    setBusy(true);
    try {
      const data = new FormData();
      data.set("photo", file);
      const result = await uploadProfilePhoto(data);
      if (result.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (result.status === "UPLOADED") {
        setDone(true);
        router.refresh();
        return;
      }
      setFailure(result.status);
    } catch {
      setFailure("FAILED");
    } finally {
      setBusy(false);
    }
  }

  const f = failure ? FAILURES[failure] : null;
  const shownImage = preview ?? currentUrl;
  const fileLabel = file
    ? [file.name, f?.showType ? file.name.split(".").pop()?.toUpperCase() : null, formatMegabytes(file.size)].filter(Boolean).join(" · ")
    : "";

  let primary: { label: string; onClick: () => void };
  if (done) primary = { label: t("my.ok"), onClick: () => setOpen(false) };
  else if (failure === "FAILED") primary = { label: t(f!.retry), onClick: save };
  else if (failure) primary = { label: t(f!.retry), onClick: () => inputRef.current?.click() };
  else primary = { label: t("myEdit.photoSave"), onClick: save };

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {t("myEdit.photoChange")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={done ? t("myEdit.photoDoneTitle") : f ? t(f.title) : t("myEdit.photoTitle")}
        description={done ? t("myEdit.photoDone") : f ? t(f.headline) : t("myEdit.photoDesc")}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {done ? t("my.close") : t("my.cancel")}
            </button>
            <button
              type="button"
              className={styles.primary}
              onClick={primary.onClick}
              disabled={busy || (!done && !failure && !file)}
              aria-busy={busy || undefined}
            >
              {primary.label}
            </button>
          </>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.srOnly}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className={styles.photo} aria-live="polite">
          {f ? (
            <span className={styles.statusCircle}>
              <AlertTriangleIcon />
            </span>
          ) : (
            <span className={`${styles.preview} ${done ? styles.previewSuccess : ""}`}>
              {shownImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview (blob:) or uploaded data URL
                <img src={shownImage} alt={t("myEdit.photoPreview")} className={styles.previewImage} />
              ) : (
                <span className={styles.previewFallback} aria-hidden="true">
                  {nickname.slice(0, 1)}
                </span>
              )}
            </span>
          )}

          {(f || done) && (
            <div className={styles.statusText}>
              <p className={`${styles.statusHeadline} ${done ? styles.statusHeadlineSuccess : ""}`} role={f ? "alert" : "status"}>
                {done ? t("myEdit.photoDone") : t(f!.headline)}
              </p>
              <p className={styles.statusSub}>{done ? t("myEdit.photoDoneHint") : t(f!.sub)}</p>
            </div>
          )}

          {file && (f || done) && (
            <div className={`${styles.fileRow} ${done ? styles.fileRowSuccess : ""}`}>
              <span className={styles.fileName}>
                <FileImageIcon />
                <span>{fileLabel}</span>
              </span>
              <span className={styles.fileBadge}>{done ? t("myEdit.photoApplied") : t("my.needsCheck")}</span>
            </div>
          )}

          {!f && !done && (
            <>
              <button type="button" className={styles.uploadButton} onClick={() => inputRef.current?.click()}>
                <UploadIcon />
                {t("myEdit.photoSelect")}
              </button>
              <p className={styles.hint}>
                {file ? `${file.name} · ${formatMegabytes(file.size)}` : t("myEdit.photoSpec")}
              </p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
