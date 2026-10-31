"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import { ChatPanel } from "./ChatPanel";
import { MOCK_MESSAGES, type ChatMessage } from "./chatMessages";
import { DonationForm } from "./DonationForm";
import styles from "./room.module.css";

export type Tab = "DONATION" | "CHAT";

const TABS: { key: Tab; label: MessageKey }[] = [
  { key: "DONATION", label: "room.tabDonate" },
  { key: "CHAT", label: "room.tabChat" }
];

/** Figma 420×600 right panel: 후원하기 (610:138) / 채팅하기 (826:685). */
export function SidePanel({
  room,
  signedIn,
  fnBalance,
  nickname,
  initialTab = "CHAT"
}: {
  room: CreatorRoom;
  signedIn: boolean;
  fnBalance: number | null;
  nickname: string | null;
  /** `?tab=donation` (e.g. from the home 크리에이터 프로필 popup) opens the donation tab. */
  initialTab?: Tab;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>(initialTab);
  // Local echo only; the realtime chat and donation feed are TBD.
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const sendChat = (text: string) =>
    setMessages((list) => [
      ...list,
      { id: `local-${Date.now()}`, kind: "CHAT", nickname: nickname ?? t("room.me"), handle: "", color: "var(--color-accent)", avatarUrl: null, text }
    ]);
  const announceDonation = ({ fnAmount, text, anonymous }: { fnAmount: number; text: string; anonymous: boolean }) =>
    setMessages((list) => [
      ...list,
      {
        id: `donation-${Date.now()}`,
        kind: "DONATION",
        title: t("room.donated", { name: anonymous ? t("room.anonymous") : (nickname ?? t("room.me")), amount: formatNumber(fnAmount) }),
        text
      }
    ]);

  return (
    <section className={styles.panel} aria-label={t("room.panel")}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`room-tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls={`room-panel-${item.key}`}
            className={`${styles.tab} ${tab === item.key ? styles.tabActive : ""}`}
            onClick={() => setTab(item.key)}
          >
            {t(item.label)}
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
