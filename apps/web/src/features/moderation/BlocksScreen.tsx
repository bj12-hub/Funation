"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatKstDate } from "@/lib/format";
import { unblock } from "@/services/moderation/moderation";
import type { BlockEntry } from "@/services/moderation/moderationTypes";
import styles from "./moderation.module.css";

/** 차단 관리 — code-first (no Figma frame). Route `/mypage/blocks`. */
export function BlocksScreen({ blocks }: { blocks: BlockEntry[] }) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const release = (b: BlockEntry) =>
    startTransition(async () => {
      try {
        const res = await unblock(b.id);
        setNote(res.status === "OK" ? `${res.name}님의 차단을 해제했어요.` : "이미 해제된 사용자예요.");
        router.refresh();
      } catch {
        setNote("해제하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });

  return (
    <div className={styles.page}>
      <Link href="/mypage" className={styles.back}>
        ← 마이페이지
      </Link>
      <h1 className={styles.title}>차단 관리</h1>
      <p className={styles.muted}>차단한 사용자의 커뮤니티 글 · 댓글, 채널 커뮤니티 글, 쪽지가 나에게 보이지 않아요. 상대에게는 차단 사실이 알려지지 않아요.</p>
      {blocks.length === 0 ? (
        <p className={styles.empty}>차단한 사용자가 없어요. 글이나 쪽지의 &ldquo;차단&rdquo;으로 차단할 수 있어요.</p>
      ) : (
        <ul className={styles.blockList}>
          {blocks.map((b) => (
            <li key={b.id} className={styles.blockItem}>
              <span className={styles.blockName}>{b.name}</span>
              <span className={styles.muted}>{formatKstDate(b.since)} 차단</span>
              <button type="button" className={styles.unblock} disabled={pending} onClick={() => release(b)}>
                차단 해제
              </button>
            </li>
          ))}
        </ul>
      )}
      {note && (
        <p className={styles.muted} role="status">
          {note}
        </p>
      )}
    </div>
  );
}
