"use client";

import Image from "next/image";
import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { remote } from "@/lib/remoteImage";
import type { CreatorRoom } from "@/services/creators/creatorRoom";
import { ChatPanel } from "./ChatPanel";
import { MOCK_MESSAGES, type ChatMessage } from "./chatMessages";
import { DonationForm } from "./DonationForm";
import { FlextvChat } from "./FlextvChat";
import { StreamDonors } from "./RoomLive";
import styles from "./room.module.css";

export type Tab = "DONATION" | "CHAT" | "SIGNATURES";

const TABS: { key: Tab; label: string }[] = [
  { key: "DONATION", label: "후원하기" },
  { key: "CHAT", label: "채팅하기" }
];

/** A FLEXTV channel's room (phase 10, funnation's live room): 채팅 · 후원 · 시그니처. */
const FLEXTV_TABS: { key: Tab; label: string }[] = [
  { key: "CHAT", label: "채팅" },
  { key: "DONATION", label: "후원" },
  { key: "SIGNATURES", label: "시그니처" }
];

/**
 * Figma 420×600 right panel: 후원하기 (610:138) / 채팅하기 (826:685). A FLEXTV channel's room (phase 10) has 채팅 (with
 * 이번 방송 후원 랭킹 over it) · 후원 · 시그니처, after funnation's live room; 채팅 only while its stream plays here.
 */
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
  // A FLEXTV channel's room (docs/development/flextv-backend.md): the chat is its stream's, while FLEXTV's player plays
  // it here; otherwise 후원하기 only.
  const flextv = room.source === "FLEXTV";
  const flextvStream = flextv && room.stream.status === "LIVE" ? (room.stream.embed ?? null) : null;
  const tabs = flextv
    ? FLEXTV_TABS.filter((t) => (t.key !== "CHAT" || flextvStream) && (t.key !== "SIGNATURES" || room.donation.signatures.length > 0))
    : TABS;
  const [tab, setTab] = useState<Tab>(tabs.some((t) => t.key === initialTab) ? initialTab : tabs[0].key);
  // A signature picked on the 시그니처 tab opens the 후원 tab with it chosen.
  const [pick, setPick] = useState<{ signatureId: string; seq: number } | null>(null);
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
        {tabs.map((t) => (
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
          extras={!flextv}
          pick={pick}
        />
      </div>
      {!flextv && (
        <div id="room-panel-CHAT" role="tabpanel" aria-labelledby="room-tab-CHAT" className={styles.tabPanel} hidden={tab !== "CHAT"}>
          <ChatPanel signedIn={signedIn} messages={messages} onSend={sendChat} />
        </div>
      )}
      {flextvStream && (
        <div id="room-panel-CHAT" role="tabpanel" aria-labelledby="room-tab-CHAT" className={styles.tabPanel} hidden={tab !== "CHAT"}>
          <StreamDonors />
          <FlextvChat channelId={room.creatorId} streamId={flextvStream.streamId} signedIn={signedIn} />
        </div>
      )}
      {flextv && room.donation.signatures.length > 0 && (
        <div id="room-panel-SIGNATURES" role="tabpanel" aria-labelledby="room-tab-SIGNATURES" className={styles.tabPanel} hidden={tab !== "SIGNATURES"}>
          <ul className={styles.sigPicker} aria-label="시그니처">
            {[...room.donation.signatures]
              .sort((a, b) => a.rank - b.rank)
              .map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={styles.sigPick}
                    title="이 시그니처로 후원해요"
                    onClick={() => {
                      setPick((p) => ({ signatureId: s.id, seq: (p?.seq ?? 0) + 1 }));
                      setTab("DONATION");
                    }}
                  >
                    <span className={styles.sigPickImage}>
                      <Image src={s.imageUrl} alt="" fill sizes="120px" unoptimized={remote(s.imageUrl)} />
                    </span>
                    <strong className={styles.sigPickPrice}>{formatNumber(s.price)} FN</strong>
                    <span className={styles.sigPickName}>{s.name}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}
