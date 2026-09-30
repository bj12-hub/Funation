"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { addFavorite, removeFavorite } from "@/services/favorites/favorites";
import { ModerationActions } from "../moderation/ModerationActions";
import styles from "./room.module.css";

type ToastState = { message: string; tone: "accent" | "neutral" } | null;

/** Figma 826:510 favorite toggle + 826:387 share modal. */
export function RoomActions({ creatorId, name, initialFavorite, signedIn }: { creatorId: string; name: string; initialFavorite: boolean; signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, startTransition] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const toggleFavorite = () => {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    startTransition(async () => {
      const result = favorite ? await removeFavorite(creatorId) : await addFavorite(creatorId);
      if (result.status === "UNAUTHORIZED") {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      // NOT_FOUND on removal means it is already gone — the end state is the same.
      const next = !favorite;
      setFavorite(next);
      setToast({ message: next ? "즐겨찾기에 추가했습니다." : "즐겨찾기를 해제했습니다.", tone: "accent" });
    });
  };

  return (
    <>
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.actionButton} ${favorite ? styles.favoriteOn : ""}`}
          aria-pressed={favorite}
          disabled={pending}
          onClick={toggleFavorite}
        >
          ⭐ {favorite ? "즐겨찾기 완료" : "즐겨찾기"}
        </button>
        <button type="button" className={styles.actionButton} onClick={() => setShareOpen(true)}>
          🔗 공유
        </button>
        {/* Code-first (no Figma frame): write to this creator. */}
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => router.push(signedIn ? `/messages?to=${encodeURIComponent(creatorId)}` : `/login?next=${encodeURIComponent(pathname)}`)}
        >
          ✉️ 쪽지
        </button>
        <ModerationActions target={{ type: "CREATOR", id: creatorId }} signedIn={signedIn} block={false} className={styles.reportLink} />
      </div>
      <ShareModal
        open={shareOpen}
        name={name}
        onClose={() => setShareOpen(false)}
        onDone={(message) => {
          setShareOpen(false);
          setToast({ message, tone: "neutral" });
        }}
      />
      <Toast message={toast?.message ?? null} tone={toast?.tone} onDone={clearToast} />
    </>
  );
}

const SHARE_TARGETS = [
  { key: "kakao", emoji: "💬", label: "카카오톡", url: null },
  { key: "naver", emoji: "🟢", label: "네이버", url: (u: string, t: string) => `https://share.naver.com/web/shareView?url=${u}&title=${t}` },
  { key: "telegram", emoji: "✈️", label: "텔레그램", url: (u: string, t: string) => `https://t.me/share/url?url=${u}&text=${t}` },
  { key: "x", emoji: "𝕏", label: "X", url: (u: string, t: string) => `https://twitter.com/intent/tweet?url=${u}&text=${t}` }
] as const;

function ShareModal({ open, name, onClose, onDone }: { open: boolean; name: string; onClose: () => void; onDone: (message: string) => void }) {
  const [copyFailed, setCopyFailed] = useState(false);
  const link = typeof window === "undefined" ? "" : window.location.href.split("?")[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      onDone("링크를 복사했습니다.");
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="공유하기" description={`${name}님의 라이브 방송을 친구에게 공유해보세요.`}>
      <ul className={styles.shareTargets}>
        {SHARE_TARGETS.map((t) => (
          <li key={t.key}>
            {t.url ? (
              <button
                type="button"
                className={styles.shareTarget}
                onClick={() => {
                  window.open(t.url(encodeURIComponent(link), encodeURIComponent(`${name} | Somnation`)), "_blank", "noopener,noreferrer");
                  onDone("공유가 완료되었습니다.");
                }}
              >
                <span aria-hidden="true">{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ) : (
              // TODO: KakaoTalk share needs the Kakao JS SDK app key (TBD).
              <button type="button" className={styles.shareTarget} aria-disabled="true" title="준비 중인 기능입니다">
                <span aria-hidden="true">{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.linkBox}>
        <span className={styles.linkText}>{link}</span>
        <button type="button" className={styles.copy} onClick={copy}>
          링크 복사
        </button>
      </div>
      {copyFailed && (
        <p className={`${styles.validation} ${styles.validationError}`} role="alert">
          링크를 복사하지 못했습니다. 주소를 직접 선택해 복사해 주세요.
        </p>
      )}
    </Modal>
  );
}
