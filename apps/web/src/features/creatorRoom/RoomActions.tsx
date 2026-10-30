"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { addFavorite, removeFavorite } from "@/services/favorites/favorites";
import { FlextvReportButton } from "../moderation/FlextvReportButton";
import { ModerationActions } from "../moderation/ModerationActions";
import styles from "./room.module.css";

type ToastState = { message: string; tone: "accent" | "neutral" } | null;

/**
 * Figma 826:510 favorite toggle + 826:387 share modal. In a FLEXTV channel's room (phase 7) the 즐겨찾기 is FLEXTV's,
 * which asks for its 본인인증, a 쪽지 goes to the owner's 아이디 (`messageTo`, phase 9), and 신고 is FLEXTV's 방송 신고
 * (phase 10); there is no 차단.
 */
export function RoomActions({
  creatorId,
  name,
  initialFavorite,
  signedIn,
  flextv = false,
  messageTo
}: {
  creatorId: string;
  name: string;
  initialFavorite: boolean;
  signedIn: boolean;
  flextv?: boolean;
  messageTo?: string;
}) {
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
      let result: Awaited<ReturnType<typeof addFavorite | typeof removeFavorite>>;
      try {
        result = favorite ? await removeFavorite(creatorId) : await addFavorite(creatorId);
      } catch {
        // The request failed (network / server): the button stays as it was, and the room with it.
        setToast({ message: "즐겨찾기를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.", tone: "neutral" });
        return;
      }
      if (result.status === "UNAUTHORIZED") {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (result.status === "NEEDS_VERIFICATION") {
        setToast({ message: "즐겨찾기는 FLEXTV 본인인증 후에 할 수 있어요. 마이페이지에서 본인인증을 진행해 주세요.", tone: "neutral" });
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
        {(!flextv || messageTo) && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => router.push(signedIn ? `/messages?to=${encodeURIComponent(messageTo ?? creatorId)}` : `/login?next=${encodeURIComponent(pathname)}`)}
          >
            ✉️ 쪽지
          </button>
        )}
        {flextv ? (
          <FlextvReportButton channelId={creatorId} signedIn={signedIn} className={styles.reportLink} />
        ) : (
          <ModerationActions target={{ type: "CREATOR", id: creatorId }} signedIn={signedIn} block={false} className={styles.reportLink} />
        )}
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

// 카카오톡 is left out until the Kakao JS SDK app key exists (2026-10-06 결정: hidden rather than shown disabled).
const SHARE_TARGETS = [
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
            <button
              type="button"
              className={styles.shareTarget}
              onClick={() => {
                window.open(t.url(encodeURIComponent(link), encodeURIComponent(`${name} | Ssumnation`)), "_blank", "noopener,noreferrer");
                onDone("공유가 완료되었습니다.");
              }}
            >
              <span aria-hidden="true">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
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
