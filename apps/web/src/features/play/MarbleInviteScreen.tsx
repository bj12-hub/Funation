"use client";

import { useRef, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { joinMarble } from "@/services/play/marble";
import { MARBLE_NAME_MAX, type MarbleInviteView } from "@/services/play/marbleTypes";
import styles from "./marbleInvite.module.css";

/**
 * 마블 룰렛 초대 링크 (VIP) — code-first (no Figma frame), route `/play/marble/[token]`, no login. A viewer with the link puts
 * in a name and joins the open round once; the link stops working when the race starts.
 */
export function MarbleInviteScreen({ token, invite }: { token: string; invite: MarbleInviteView | null }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [joined, setJoined] = useState<{ name: string; players: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  if (!invite) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.title}>{t("play.marble")}</h1>
          <p className={styles.note}>{t("play.closed")}</p>
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
        setError(t("play.joinError"));
      }
    });
  };

  // "{name}" marks where the bold name goes in the sentence.
  const joinedText = t("play.marbleJoined", { players: joined?.players ?? 0 }).split("{name}");

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="marble-invite-title">
        <h1 id="marble-invite-title" className={styles.title}>
          🔮 {invite.title}
        </h1>
        {joined ? (
          <p className={styles.done} role="status">
            {joinedText[0]}
            <strong>{joined.name}</strong>
            {joinedText[1]}
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
              {t("play.marbleNote", { players: invite.players, max: invite.maxPlayers })}
            </p>
            <input className={styles.input} aria-label={t("play.nameAria")} placeholder={t("play.name")} maxLength={MARBLE_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button type="submit" className={styles.primary} disabled={pending || !name.trim()}>
              {t("play.join")}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
