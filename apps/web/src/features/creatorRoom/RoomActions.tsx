"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();
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
        setToast({ message: t("room.favoriteError"), tone: "neutral" });
        return;
      }
      if (result.status === "UNAUTHORIZED") {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (result.status === "NEEDS_VERIFICATION") {
        setToast({ message: t("room.favoriteNeedsVerification"), tone: "neutral" });
        return;
      }
      // NOT_FOUND on removal means it is already gone — the end state is the same.
      const next = !favorite;
      setFavorite(next);
      setToast({ message: next ? t("room.favoriteAdded") : t("room.favoriteRemoved"), tone: "accent" });
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
          ⭐ {favorite ? t("room.favoriteOn") : t("room.favorite")}
        </button>
        <button type="button" className={styles.actionButton} onClick={() => setShareOpen(true)}>
          {t("room.share")}
        </button>
        {/* Code-first (no Figma frame): write to this creator. */}
        {(!flextv || messageTo) && (
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => router.push(signedIn ? `/messages?to=${encodeURIComponent(messageTo ?? creatorId)}` : `/login?next=${encodeURIComponent(pathname)}`)}
          >
            {t("room.message")}
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
  { key: "naver", emoji: "🟢", label: "room.shareNaver", url: (u: string, t: string) => `https://share.naver.com/web/shareView?url=${u}&title=${t}` },
  { key: "telegram", emoji: "✈️", label: "room.shareTelegram", url: (u: string, t: string) => `https://t.me/share/url?url=${u}&text=${t}` },
  { key: "x", emoji: "𝕏", label: "room.shareX", url: (u: string, t: string) => `https://twitter.com/intent/tweet?url=${u}&text=${t}` }
] as const;

function ShareModal({ open, name, onClose, onDone }: { open: boolean; name: string; onClose: () => void; onDone: (message: string) => void }) {
  const { t } = useI18n();
  const [copyFailed, setCopyFailed] = useState(false);
  const link = typeof window === "undefined" ? "" : window.location.href.split("?")[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyFailed(false);
      onDone(t("room.copied"));
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("room.shareTitle")} description={t("room.shareDescription", { name })}>
      <ul className={styles.shareTargets}>
        {SHARE_TARGETS.map((target) => (
          <li key={target.key}>
            <button
              type="button"
              className={styles.shareTarget}
              onClick={() => {
                window.open(target.url(encodeURIComponent(link), encodeURIComponent(`${name} | Ssumnation`)), "_blank", "noopener,noreferrer");
                onDone(t("room.shared"));
              }}
            >
              <span aria-hidden="true">{target.emoji}</span>
              <span>{t(target.label)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.linkBox}>
        <span className={styles.linkText}>{link}</span>
        <button type="button" className={styles.copy} onClick={copy}>
          {t("room.copyLink")}
        </button>
      </div>
      {copyFailed && (
        <p className={`${styles.validation} ${styles.validationError}`} role="alert">
          {t("room.copyFailed")}
        </p>
      )}
    </Modal>
  );
}
