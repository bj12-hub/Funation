"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import { ChatPanel } from "./ChatPanel";
import { MOCK_MESSAGES, type ChatMessage } from "./chatMessages";
import { DonationForm } from "./DonationForm";
import styles from "./room.module.css";

type Tab = "DONATION" | "CHAT";

const TABS: { key: Tab; label: string }[] = [
  { key: "DONATION", label: "후원하기" },
  { key: "CHAT", label: "채팅하기" }
];

/** Figma 420×600 right panel: 후원하기 (610:138) / 채팅하기 (826:685). */
export function SidePanel({
  room,
  signedIn,
  fnBalance,
  nickname
}: {
  room: CreatorRoom;
  signedIn: boolean;
  fnBalance: number | null;
  nickname: string | null;
}) {
  const [tab, setTab] = useState<Tab>("CHAT");
  // Local echo only; the realtime chat and donation feed are TBD.
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const sendChat = (text: string) =>
    setMessages((list) => [
      ...list,
      { id: `local-${Date.now()}`, kind: "CHAT", nickname: nickname ?? "나", handle: "", color: "var(--color-accent)", avatarUrl: null, text }
    ]);
  const announceDonation = ({ fnAmount, text, anonymous }: { fnAmount: number; text: string; anonymous: boolean }) =>
    setMessages((list) => [
      ...list,
      {
        id: `donation-${Date.now()}`,
        kind: "DONATION",
        title: `${anonymous ? "익명" : (nickname ?? "나")} 님이 ${formatNumber(fnAmount)} FN을 후원했습니다.`,
        text
      }
    ]);

  return (
    <section className={styles.panel} aria-label="후원 및 채팅">
      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`room-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`room-panel-${t.key}`}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Both panels stay mounted so a draft message or amount survives tab switches. */}
      <div id="room-panel-DONATION" role="tabpanel" aria-labelledby="room-tab-DONATION" className={styles.tabPanel} hidden={tab !== "DONATION"}>
        <DonationForm
          creatorId={room.creatorId}
          name={room.name}
          donation={room.donation}
          signedIn={signedIn}
          fnBalance={fnBalance}
          onDonated={announceDonation}
        />
      </div>
      <div id="room-panel-CHAT" role="tabpanel" aria-labelledby="room-tab-CHAT" className={styles.tabPanel} hidden={tab !== "CHAT"}>
        <ChatPanel signedIn={signedIn} messages={messages} onSend={sendChat} />
      </div>
    </section>
  );
}
