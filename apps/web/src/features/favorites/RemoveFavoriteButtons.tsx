"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { removeFavorite } from "@/services/favorites/favorites";
import styles from "./favorites.module.css";

/**
 * The heart (735:3975) and "즐겨찾기 해제" (735:3993) both remove the creator from favorites.
 * PROCESSING disables the control; a failure shows an inline error.
 */
export function RemoveFavoriteButtons({ creatorId, name, part }: { creatorId: string; name: string; part: "heart" | "button" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    setBusy(true);
    setFailed(false);
    try {
      const result = await removeFavorite(creatorId);
      if (result.status === "UNAUTHORIZED") return router.push("/login?next=/favorites");
      router.refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  if (part === "heart") {
    return (
      <button
        type="button"
        className={styles.heart}
        aria-label={t("myFavorites.removeLabel", { name })}
        aria-pressed="true"
        disabled={busy}
        onClick={remove}
      >
        <HeartIcon />
      </button>
    );
  }

  return (
    <>
      <button type="button" className={styles.unfavorite} disabled={busy} aria-busy={busy || undefined} onClick={remove}>
        {t("myFavorites.remove")}
      </button>
      {failed && (
        <span className={styles.rowError} role="alert">
          {t("myFavorites.removeFailed")}
        </span>
      )}
    </>
  );
}
