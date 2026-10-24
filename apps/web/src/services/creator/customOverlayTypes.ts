import type { Platform } from "@/types/platform";

/**
 * 커스텀 오버레이 — code-first, StreamDonate "오버레이 커스텀" 참고 (P3). The creator writes an overlay in HTML · CSS · JS
 * (슬롯 5개). The code never runs on the site's origin: OBS and the studio preview load it into a sandboxed frame
 * (`sandbox="allow-scripts"`, no same-origin — an opaque origin with its own strict CSP), which gets the code and the live
 * data by postMessage and calls the creator's `onData(type, data)`.
 */

export const CUSTOM_SLOTS = 5;
export const CUSTOM_NAME_MAX = 20;
/** Each of HTML · CSS · JS, characters. */
export const CUSTOM_CODE_MAX = 20_000;
/** Chat lines a newly loaded overlay gets first (oldest first), so a chat box starts filled. */
export const CUSTOM_CHAT_HISTORY = 20;
/** The static sandbox page every custom overlay frame loads (headers: next.config.ts). */
export const SANDBOX_SRC = "/sandbox/custom-overlay.html";

export type CustomCode = { html: string; css: string; js: string };
export type CustomSlot = CustomCode & { name: string; enabled: boolean };
export const emptySlot = (no: number): CustomSlot => ({ name: `커스텀 ${no}`, enabled: false, html: "", css: "", js: "" });

/** `onData("donation", …)`: a donation alert as it starts showing (the public fields the alert overlay shows). */
export type CustomDonation = {
  id: string;
  /** DONATION · EXTERNAL (플랫폼 후원 연동) · TEST (테스트 후원). */
  kind: string;
  nickname: string;
  message: string;
  /** FN (0 for EXTERNAL — see `amountLabel`). */
  amount: number;
  /** As shown: "1,000 FN", or the platform amount for EXTERNAL ("₩5,000"). */
  amountLabel: string;
  typeLabel: string;
  platform: Platform | null;
  imageUrl: string | null;
  /** When the alert overlay stops showing it. */
  endsAt: string;
};
/** `onData("chat", …)`: a 통합 채팅 line (필터링 닉네임 left out). */
export type CustomChat = { id: string; platform: Platform; nickname: string; text: string; at: string };

/** The studio: the slots, and the key the OBS addresses need (creator only). */
export type CustomOverlayView = { slots: CustomSlot[]; overlayKey: string };
export type CustomResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
/** OBS: the slot's code (null while it is off or empty), what it gets through `onData`, and 리모컨 `reloadSeq` · `on`. */
export type CustomOverlayData = { slot: number; name: string; code: CustomCode | null; donation: CustomDonation | null; chat: CustomChat[]; reloadSeq: number; on: boolean };

/** The `?slot=` value as a slot number (1 when it names none). */
export const slotByQuery = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= CUSTOM_SLOTS ? n : 1;
};
