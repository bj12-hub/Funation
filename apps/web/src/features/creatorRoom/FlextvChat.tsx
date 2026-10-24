"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getRoomChat, sendRoomChat } from "@/services/live/flextvRoomChat";
import { ROOM_CHAT_MAX } from "@/services/live/roomChatTypes";
import { ChatPanel } from "./ChatPanel";
import type { ChatMessage } from "./chatMessages";

/** How often the open chat asks for new lines, and how many it keeps. */
const POLL_MS = 2_000;
const KEEP = 200;

/**
 * A FLEXTV stream's chat in its channel room (FLEXTV backend phase 4): the newest lines every two seconds while the page
 * is visible, sending through Ssumnation's server. Lines are kept in arrival order, at most KEEP.
 */
export function FlextvChat({ channelId, streamId, signedIn }: { channelId: string; streamId: string; signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const seen = useRef(new Set<string>());

  const read = useCallback(async () => {
    const r = await getRoomChat(channelId, streamId).catch(() => null);
    if (r?.status !== "OK") return;
    const fresh = r.lines.filter((l) => !seen.current.has(l.id));
    if (fresh.length === 0) return;
    for (const l of fresh) seen.current.add(l.id);
    setMessages((list) =>
      [...list, ...fresh.map((l): ChatMessage => ({ id: l.id, kind: "CHAT", nickname: l.nickname, handle: "", color: l.color, avatarUrl: null, text: l.text }))].slice(-KEEP)
    );
  }, [channelId, streamId]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible") await read();
      if (alive) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [read]);

  const send = (text: string) => {
    setNotice(null);
    void sendRoomChat({ channelId, streamId, text })
      .then((r) => {
        if (r.status === "SENT") return read();
        if (r.status === "UNAUTHORIZED") return router.push(`/login?next=${encodeURIComponent(pathname)}`);
        setNotice(r.message);
      })
      .catch(() => setNotice("메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요."));
  };

  return <ChatPanel signedIn={signedIn} messages={messages} onSend={send} maxLength={ROOM_CHAT_MAX} notice={notice} />;
}
