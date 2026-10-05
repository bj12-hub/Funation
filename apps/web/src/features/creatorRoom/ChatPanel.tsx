"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DefaultAvatarIcon, GiftIcon, SmileIcon } from "@/components/icons";
import type { ChatMessage } from "./chatMessages";
import styles from "./room.module.css";

const MAX_LENGTH = 200;

/**
 * Figma 826:685 chat tab. Messages are owned by SidePanel (mock data + local echoes).
 * TODO: realtime chat transport, moderation and rate limiting belong to the backend (TBD).
 */
export function ChatPanel({ signedIn, messages, onSend }: { signedIn: boolean; messages: ChatMessage[]; onSend: (text: string) => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const text = draft.trim();

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className={styles.chat}>
      <ol ref={listRef} className={styles.messages} aria-label="실시간 채팅" aria-live="polite">
        {messages.map((m) =>
          m.kind === "DONATION" ? (
            <li key={m.id} className={styles.donationMessage}>
              <span className={styles.giftBox} aria-hidden="true">
                <GiftIcon />
              </span>
              <span className={styles.messageBody}>
                <span className={styles.donationTitle}>{m.title}</span>
                <span className={styles.donationText}>{m.text}</span>
              </span>
            </li>
          ) : (
            <li key={m.id} className={styles.message}>
              {m.avatarUrl ? (
                <Image src={m.avatarUrl} alt="" width={24} height={24} className={styles.messageAvatar} />
              ) : (
                <DefaultAvatarIcon className={styles.messageAvatar} aria-hidden="true" />
              )}
              <span className={styles.messageBody}>
                <span className={styles.messageNick} style={{ "--nick": m.color } as CSSProperties}>
                  {m.nickname}
                  {m.handle && <span className={styles.messageHandle}> @{m.handle}</span>}
                </span>
                <span className={styles.messageText}>{m.text}</span>
              </span>
            </li>
          )
        )}
      </ol>

      <form className={styles.composer} onSubmit={send}>
        <div className={styles.composerInput}>
          <input
            aria-label="채팅 메시지"
            value={draft}
            maxLength={MAX_LENGTH}
            placeholder={signedIn ? "실시간 라이브 채팅에 참여하세요..." : "로그인 후 채팅에 참여할 수 있어요"}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={!signedIn}
          />
          {/* TODO: emoji picker is TBD. */}
          <span className={styles.emoji} aria-hidden="true">
            <SmileIcon />
          </span>
        </div>
        <button type="submit" className={styles.send} disabled={signedIn && !text}>
          {signedIn ? "채팅 전송" : "로그인하고 채팅하기"}
        </button>
      </form>
    </div>
  );
}
