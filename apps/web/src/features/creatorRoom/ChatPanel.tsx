"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DefaultAvatarIcon, GiftIcon, SmileIcon } from "@/components/icons";
import { CHAT_EMOJIS, insertEmoji } from "./chatEmoji";
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const emojiToggleRef = useRef<HTMLButtonElement>(null);
  /**
   * Caret after the last picked emoji. React rewrites the input's value on each pick, which moves the DOM caret to
   * the end, so picks in a row continue from here; once the input is focused again its own selection is used.
   */
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onClick = (e: MouseEvent) => !emojiRef.current?.contains(e.target as Node) && setEmojiOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setEmojiOpen(false);
      emojiToggleRef.current?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  const text = draft.trim();

  // The picker stays open so several emoji can be added; focus stays on it for keyboard users.
  const pickEmoji = (emoji: string) => {
    const input = inputRef.current;
    const caret = caretRef.current ?? { start: input?.selectionStart ?? draft.length, end: input?.selectionEnd ?? draft.length };
    const next = insertEmoji(draft, emoji, caret.start, caret.end, MAX_LENGTH);
    if (!next) return;
    setDraft(next.text);
    caretRef.current = { start: next.caret, end: next.caret };
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!text) return;
    onSend(text);
    setDraft("");
    setEmojiOpen(false);
    caretRef.current = null;
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
            ref={inputRef}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => (caretRef.current = null)}
            readOnly={!signedIn}
          />
          <div className={styles.emojiWrap} ref={emojiRef}>
            <button
              ref={emojiToggleRef}
              type="button"
              className={styles.emoji}
              aria-label="이모지"
              aria-expanded={emojiOpen}
              aria-controls="chat-emoji"
              disabled={!signedIn}
              onClick={() => setEmojiOpen((v) => !v)}
            >
              <SmileIcon />
            </button>
            {emojiOpen && (
              <div id="chat-emoji" className={styles.emojiPicker} role="group" aria-label="이모지 고르기">
                {CHAT_EMOJIS.map((e) => (
                  <button key={e.emoji} type="button" aria-label={e.label} title={e.label} onClick={() => pickEmoji(e.emoji)}>
                    {e.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button type="submit" className={styles.send} disabled={signedIn && !text}>
          {signedIn ? "채팅 전송" : "로그인하고 채팅하기"}
        </button>
      </form>
    </div>
  );
}
