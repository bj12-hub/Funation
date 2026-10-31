"use client";

import { useEffect, useRef } from "react";
import { SANDBOX_SRC, type CustomOverlayData } from "@/services/creator/customOverlayTypes";
import { useOverlayPage } from "../crew/CrewScoreOverlay";
import local from "./customOverlay.module.css";
import { useSandbox } from "./useSandbox";

/**
 * 커스텀 오버레이 (`/overlay/custom/[key]?slot=N`) — code-first. The creator's code runs only in the sandboxed frame (opaque
 * origin, its own CSP), never in this page. Every refresh, chat lines it has not had yet and a donation alert that has
 * just started showing go in as `onData("chat" | "donation", …)`, and the crew 점수판 as `onData("crew", …)` whenever it
 * changes (2026-10-25); new code gets a fresh frame. Nothing while the slot is off or empty (or with 리모컨 OFF).
 */
export function CustomOverlay({ data }: { data: CustomOverlayData }) {
  useOverlayPage(data.reloadSeq);
  const code = data.on ? data.code : null;
  const { frame, key, send, onLoad } = useSandbox(code);
  const sentChat = useRef(new Set<string>());
  const sentDonation = useRef<string | null>(null);
  const sentCrew = useRef<string | null>(null);
  useEffect(() => {
    sentChat.current = new Set();
    sentDonation.current = null;
    sentCrew.current = null;
  }, [key]);
  useEffect(() => {
    if (!code) return;
    for (const c of data.chat) if (!sentChat.current.has(c.id)) send("chat", c);
    // Only the lines still in the feed are remembered (the feed is the latest few).
    sentChat.current = new Set(data.chat.map((c) => c.id));
    if (data.donation && data.donation.id !== sentDonation.current) {
      sentDonation.current = data.donation.id;
      send("donation", data.donation);
    }
    // The 점수판 when it differs from what the frame last got (a fresh frame gets it at once).
    const crew = data.crew && JSON.stringify(data.crew);
    if (data.crew && crew !== sentCrew.current) {
      sentCrew.current = crew;
      send("crew", data.crew);
    }
  }, [code, data.chat, data.donation, data.crew, send]);

  if (!code) return null;
  return <iframe key={key} ref={frame} src={SANDBOX_SRC} sandbox="allow-scripts" referrerPolicy="no-referrer" title={data.name} className={local.frame} onLoad={onLoad} />;
}
