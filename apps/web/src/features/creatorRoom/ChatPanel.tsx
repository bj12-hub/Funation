"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DefaultAvatarIcon, GiftIcon, SmileIcon } from "@/components/icons";
import styles from "./room.module.css";

type ChatMessage =
  | { id: string; kind: "CHAT"; nickname: string; handle: string; color: string; avatarUrl: string | null; text: string }
  | { id: string; kind: "DONATION"; title: string; text: string };

const MAX_LENGTH = 200;

/**
 * Figma 826:685 chat tab. Messages are mock data; sending appends locally only.
 * TODO: realtime chat transport, moderation and rate limiting belong to the backend (TBD).
 */
export function ChatPanel({ signedIn, nickname }: { signedIn: boolean; nickname: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
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
    setMessages((list) => [
      ...list,
      { id: `local-${Date.now()}`, kind: "CHAT", nickname: nickname ?? "나", handle: "", color: "var(--color-accent)", avatarUrl: null, text }
    ]);
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
                <span className={styles.messageNick} style={{ color: m.color }}>
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

// ── Mock data: Figma 826:685 ───────────────────────────────────────────────────
const MOCK_MESSAGES: ChatMessage[] = [
  { id: "m1", kind: "CHAT", nickname: "크리에이터팬클럽", handle: "FNCL_01", color: "#ec4899", avatarUrl: "/mock/room/chat-avatar-1.png", text: "하음파 썰 미쳤다 그냥 화이팅!!" },
  { id: "m2", kind: "CHAT", nickname: "탑스타최강", handle: "TSCG_88", color: "#8b5cf6", avatarUrl: null, text: "오늘 무대 구성 역대급이네요 ㄷㄷ" },
  { id: "m3", kind: "CHAT", nickname: "우왁꾿마니아", handle: "WKMN_42", color: "#06b6d4", avatarUrl: "/mock/room/chat-avatar-2.png", text: "다음 게스트 스포 가능한가요?" },
  { id: "m4", kind: "DONATION", title: "도네만선 님이 1,000 FN을 후원했습니다.", text: "오늘도 즐거운 방송 응원할게요!" },
  { id: "m5", kind: "CHAT", nickname: "오디션투표", handle: "ODTP_19", color: "#f5bf0a", avatarUrl: "/mock/room/chat-avatar-3.png", text: "방금 춤선 장난 아니었습니다" },
  { id: "m6", kind: "CHAT", nickname: "도네만선", handle: "DNMS_12", color: "#10b981", avatarUrl: "/mock/room/chat-avatar-4.png", text: "후원 갑니다 가자!!" },
  { id: "m7", kind: "CHAT", nickname: "하팬음대파표", handle: "HPMP_03", color: "#f3f4f6", avatarUrl: null, text: "항상 실시간 라이브 최고에요" }
];
