"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangleIcon, FileImageIcon, UploadIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
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

const FAILURES: Record<Failure, { title: string; headline: string; sub: string; retry: string; showType: boolean }> = {
  UNSUPPORTED: {
    title: "지원하지 않는 파일 형식",
    headline: "선택한 파일 형식은 업로드할 수 없어요.",
    sub: "JPG, PNG, WEBP 형식의 이미지를 선택해 주세요.",
    retry: "다른 이미지 선택",
    showType: true
  },
  TOO_LARGE: {
    title: "파일 용량 초과",
    headline: "이미지 용량이 최대 허용 크기를 초과했어요.",
    sub: "5MB 이하의 파일을 다시 선택해 주세요.",
    retry: "다시 선택",
    showType: false
  },
  FAILED: {
    title: "업로드 실패",
    headline: "프로필 사진을 업로드하지 못했어요.",
    sub: "네트워크 연결을 확인하거나 잠시 후 다시 시도해 주세요.",
    retry: "다시 시도",
    showType: false
  }
};

type Props = { triggerClassName: string; currentUrl: string | null; nickname: string };

export function PhotoEditor({ triggerClassName, currentUrl, nickname }: Props) {
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
  if (done) primary = { label: "확인", onClick: () => setOpen(false) };
  else if (failure === "FAILED") primary = { label: f!.retry, onClick: save };
  else if (failure) primary = { label: f!.retry, onClick: () => inputRef.current?.click() };
  else primary = { label: "사진 저장", onClick: save };

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
        사진 변경
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={done ? "프로필 사진 적용 완료" : f ? f.title : "프로필 사진 변경"}
        description={done ? "새 프로필 사진이 적용되었어요." : f ? f.headline : "새 프로필 이미지를 업로드하고 미리보기를 확인해 주세요."}
        footer={
          <>
            <button type="button" className={styles.secondary} onClick={() => setOpen(false)}>
              {done ? "닫기" : "취소"}
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
                <img src={shownImage} alt="프로필 사진 미리보기" className={styles.previewImage} />
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
                {done ? "새 프로필 사진이 적용되었어요." : f!.headline}
              </p>
              <p className={styles.statusSub}>{done ? "마이페이지와 활동 프로필에서 새 사진을 확인할 수 있어요." : f!.sub}</p>
            </div>
          )}

          {file && (f || done) && (
            <div className={`${styles.fileRow} ${done ? styles.fileRowSuccess : ""}`}>
              <span className={styles.fileName}>
                <FileImageIcon />
                <span>{fileLabel}</span>
              </span>
              <span className={styles.fileBadge}>{done ? "적용됨" : "확인 필요"}</span>
            </div>
          )}

          {!f && !done && (
            <>
              <button type="button" className={styles.uploadButton} onClick={() => inputRef.current?.click()}>
                <UploadIcon />
                이미지 선택
              </button>
              <p className={styles.hint}>
                {file ? `${file.name} · ${formatMegabytes(file.size)}` : "JPG, PNG · 최대 5MB · 권장 400×400px"}
              </p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
