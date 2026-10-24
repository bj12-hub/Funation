"use client";

import { useRef, useState, useTransition } from "react";
import { joinMarble } from "@/services/play/marble";
import { MARBLE_NAME_MAX, type MarbleInviteView } from "@/services/play/marbleTypes";
import styles from "./marbleInvite.module.css";

/**
 * 마블 룰렛 초대 링크 (VIP) — code-first (no Figma frame), route `/play/marble/[token]`, no login. A viewer with the link puts
 * in a name and joins the open round once; the link stops working when the race starts.
 */
export function MarbleInviteScreen({ token, invite }: { token: string; invite: MarbleInviteView | null }) {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState<{ name: string; players: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  if (!invite) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.title}>🔮 마블 룰렛</h1>
          <p className={styles.note}>참가 모집이 끝났거나 없는 링크예요.</p>
        </section>
      </main>
    );
  }

  const join = () => {
    setError(null);
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    startTransition(async () => {
      try {
        const res = await joinMarble({ token, name, requestId: id });
        if (res.status === "JOINED") {
          setJoined({ name: name.trim(), players: res.players });
          requestId.current = null;
        } else setError(res.message);
      } catch {
        setError("참가하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="marble-invite-title">
        <h1 id="marble-invite-title" className={styles.title}>
          🔮 {invite.title}
        </h1>
        {joined ? (
          <p className={styles.done} role="status">
            <strong>{joined.name}</strong> 님, 참가했어요! 방송에서 구슬 레이스를 지켜봐 주세요. ({joined.players}명 참가)
          </p>
        ) : (
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <p className={styles.note}>
              초대받은 사람만 참가할 수 있어요. 방송에 보일 이름을 넣어 주세요. ({invite.players}/{invite.maxPlayers}명)
            </p>
            <input className={styles.input} aria-label="참가할 이름" placeholder="이름" maxLength={MARBLE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button type="submit" className={styles.primary} disabled={pending || !name.trim()}>
              참가하기
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
