"use client";

import Link from "next/link";
import { useState } from "react";
import { formatKstTime } from "@/lib/format";
import type { RemoteResult } from "@/services/creator/alertTypes";
import { clearWallpaper, type WallpaperRemoteView } from "@/services/creator/wallpaperRemote";
import styles from "../crew/crew.module.css";
import remote from "./remote.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });

/**
 * 리모컨 "벽지" card — code-first (2026-10-04 결정: 자동 배치 스티커 벽). Every donation sticks a sticker on
 * the 벽지 overlay until the wall is full (then the oldest gives its spot up); 벽지 비우기 starts a new wall.
 * The donations stay in the 후원 내역 — only the screen is cleared.
 */
export function WallpaperRemote({
  view,
  pending,
  run
}: {
  view: WallpaperRemoteView;
  pending: boolean;
  run: (action: () => Promise<RemoteResult>, ok?: string, after?: () => void) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className={styles.card} aria-labelledby="wallpaper-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="wallpaper-remote">
          🖼️ 벽지
        </h2>
        <Link href="/creator/widgets" className={styles.ghost}>
          벽지 디자인 설정
        </Link>
      </div>
      <p className={styles.note}>후원이 들어올 때마다 벽지 이미지 · 닉네임 · 금액 스티커가 방송 화면 빈 자리에 붙어요. 자리가 다 차면 가장 오래된 스티커부터 바뀌어요.</p>
      <div className={remote.status}>
        <span>
          붙은 스티커 {view.stickers} / {view.slots}
        </span>
        {view.clearedAt && <span className={styles.muted}>{time(view.clearedAt)}부터</span>}
      </div>
      {view.stickers === 0 && <p className={styles.empty}>아직 붙은 스티커가 없어요. 후원이 들어오면 벽지 오버레이에 붙어요.</p>}
      {confirming ? (
        <div className={remote.buttons} role="group" aria-label="벽지 비우기 확인">
          <span className={styles.muted}>방송 화면의 스티커를 모두 떼요. 후원 내역은 그대로예요.</span>
          <button
            type="button"
            className={styles.danger}
            disabled={pending}
            onClick={() => run(() => clearWallpaper(), "벽지를 비웠어요.", () => setConfirming(false))}
          >
            비우기
          </button>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => setConfirming(false)}>
            취소
          </button>
        </div>
      ) : (
        <div className={remote.buttons}>
          <button type="button" className={styles.ghost} disabled={pending || view.stickers === 0} onClick={() => setConfirming(true)}>
            벽지 비우기
          </button>
        </div>
      )}
    </section>
  );
}
