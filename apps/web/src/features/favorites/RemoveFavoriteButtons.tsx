"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { removeFavorite } from "@/services/favorites/favorites";
import styles from "./favorites.module.css";

/**
 * The heart (735:3975) and "즐겨찾기 해제" (735:3993) both remove the creator from favorites.
 * PROCESSING disables the control; a failure shows an inline error.
 */
export function RemoveFavoriteButtons({ creatorId, name, part }: { creatorId: string; name: string; part: "heart" | "button" }) {
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
        aria-label={`${name} 즐겨찾기 해제`}
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
        즐겨찾기 해제
      </button>
      {failed && (
        <span className={styles.rowError} role="alert">
          해제하지 못했습니다. 다시 시도해 주세요
        </span>
      )}
    </>
  );
}
