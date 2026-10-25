"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { reissueSignaturePageKey, setSignaturePageEnabled } from "@/services/donations/signatures";
import type { SignaturePageSettings, SignatureResult } from "@/services/donations/signatureTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";

/** The address with the key hidden after its first 4 characters (the copy button copies it whole). */
const masked = (path: string) => path.replace(/[^/]+$/, (key) => `${key.slice(0, 4)}-····-····-····`);

/**
 * 공개 시그니처 페이지 · 시그니처 ZIP — code-first (no Figma frame; StreamDonate 시그니처 관리 참고, 2026-10-25), in
 * `/creator/widgets/signatures`. The public page (off by default): 사용, its address (masked, copy, 열어 보기) and 재발급.
 * The ZIP: every signature's image and sound with 시그니처 목록 (CSV), from `/api/creator/signatures/zip`.
 */
export function SignatureShareCard({ page }: { page: SignaturePageSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const run = (action: () => Promise<SignatureResult>, ok: string) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          setNote({ tone: "ok", text: ok });
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <section className={styles.card} aria-labelledby="sig-share">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="sig-share">
          🔗 공개 시그니처 페이지 · ZIP
        </h2>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={page.enabled}
            disabled={pending}
            onChange={(e) => {
              const on = e.target.checked;
              run(() => setSignaturePageEnabled({ enabled: on }), on ? "공개 시그니처 페이지를 켰어요." : "공개 시그니처 페이지를 껐어요. 주소로 들어와도 열리지 않아요.");
            }}
          />
          공개 페이지 사용
        </label>
      </div>
      <p className={styles.note}>
        켜면 주소를 아는 사람은 로그인 없이 사용 중인 시그니처의 이미지 · 가격을 보고 소리를 들어 볼 수 있어요. 숨긴 시그니처는 보이지 않아요. 주소를 재발급하면 지금 주소는 바로
        멈춰요.
      </p>
      <div className={styles.addRow}>
        <input className={styles.input} readOnly aria-label="공개 시그니처 페이지 주소" value={`${origin}${masked(page.path)}`} />
        <CopyButton value={`${origin}${page.path}`} label="주소 복사" className={styles.ghost} />
        {page.enabled && (
          <a className={styles.ghost} href={page.path} target="_blank" rel="noreferrer">
            열어 보기
          </a>
        )}
        <button
          type="button"
          className={styles.ghost}
          disabled={pending}
          onClick={() => window.confirm("주소를 새로 만들까요? 지금 주소로는 더 이상 페이지가 열리지 않아요.") && run(reissueSignaturePageKey, "새 주소를 만들었어요. 새 주소를 다시 공유해 주세요.")}
        >
          재발급
        </button>
      </div>
      <div className={styles.addRow}>
        <a className={styles.ghost} href="/api/creator/signatures/zip" download>
          시그니처 ZIP 다운로드
        </a>
        <span className={styles.note}>모든 시그니처(숨긴 것 포함)의 이미지 · 사운드와 시그니처 목록(CSV)을 한 파일로 받아요.</span>
      </div>
      {note && (
        <p className={note.tone === "ok" ? styles.ok : styles.error} role={note.tone === "ok" ? "status" : "alert"}>
          {note.text}
        </p>
      )}
    </section>
  );
}
