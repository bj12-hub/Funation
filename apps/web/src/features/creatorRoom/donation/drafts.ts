import { formatNumber } from "@/lib/format";
import type { DonationCatalog, DonationTypeKey } from "@/services/donations/donationCatalog";
import { parseYouTubeId, type DonationDetails } from "@/services/donations/donationTypes";

/**
 * Form state per donation type and the pure step that turns it into a request.
 * The browser checks only what it needs for feedback; the server validates everything again and
 * owns prices (signature / wishlist amounts shown here are the server's catalog values).
 */

export type TextState = { amount: string; message: string; voiceId: string | null };
export type MiniState = { amount: string; text: string; colorId: string; enterToSend: boolean };
export type VideoState = { amount: string; url: string; start: string; end: string; saveToLibrary: boolean; terms: boolean };
export type SignatureState = { signatureId: string | null; message: string };
export type WishlistState = { itemId: string | null; message: string; voiceId: string | null };

export type FormStates = {
  TEXT: TextState;
  MINI: MiniState;
  VIDEO: VideoState;
  SIGNATURE: SignatureState;
  WISHLIST: WishlistState;
};

export type FormKey = keyof FormStates;

export function initialStates(catalog: DonationCatalog): FormStates {
  const voiceId = catalog.voices[0]?.id ?? null;
  return {
    TEXT: { amount: "", message: "", voiceId },
    MINI: { amount: "", text: "", colorId: catalog.miniColors[1]?.id ?? catalog.miniColors[0]?.id ?? "", enterToSend: true },
    VIDEO: { amount: "", url: "", start: "00:00", end: "00:30", saveToLibrary: false, terms: false },
    SIGNATURE: { signatureId: null, message: "" },
    WISHLIST: { itemId: null, message: "", voiceId }
  };
}

export type Draft = {
  /** Request details when the form is complete; `null` while something is missing. */
  details: DonationDetails | null;
  amount: number | null;
  /** Inline problem to show (already-typed but invalid input). */
  error: string | null;
  /** Rows for the 613:6 confirm popup. */
  summary: { label: string; value: string }[];
  /** Text for the chat notice after success. */
  chatText: string;
};

/** "mm:ss" → seconds, or null. */
export function parseClock(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const digits = (value: string) => (value ? Number(value) : null);

export function buildDraft(key: FormKey, states: FormStates, catalog: DonationCatalog): Draft {
  switch (key) {
    case "TEXT": {
      const s = states.TEXT;
      const amount = digits(s.amount);
      const min = catalog.minAmount.TEXT;
      const tooSmall = amount !== null && amount < min;
      return {
        details: amount !== null && !tooSmall ? { type: "TEXT", amount, message: s.message.trim(), voiceId: s.voiceId } : null,
        amount,
        error: tooSmall ? `최소 ${formatNumber(min)} FN부터 후원할 수 있어요` : null,
        summary: [{ label: "후원 메시지", value: s.message.trim() || "메시지 없음" }],
        chatText: s.message.trim()
      };
    }
    case "MINI": {
      const s = states.MINI;
      const amount = digits(s.amount);
      const min = catalog.minAmount.MINI;
      const tooSmall = amount !== null && amount < min;
      const text = s.text.trim();
      return {
        details: amount !== null && !tooSmall && text ? { type: "MINI", amount, text, colorId: s.colorId } : null,
        amount,
        error: tooSmall ? `최소 ${formatNumber(min)} FN부터 후원할 수 있어요` : null,
        summary: [{ label: "텍스트 내용", value: text }],
        chatText: `⚡ ${text}`
      };
    }
    case "VIDEO": {
      const s = states.VIDEO;
      const amount = digits(s.amount);
      const min = catalog.minAmount.VIDEO;
      const tooSmall = amount !== null && amount < min;
      const videoId = s.url ? parseYouTubeId(s.url) : null;
      const start = parseClock(s.start);
      const end = parseClock(s.end);
      const rangeOk = start !== null && end !== null && end > start;
      const error = tooSmall
        ? `최소 ${formatNumber(min)} FN부터 후원할 수 있어요`
        : s.url && !videoId
          ? "YouTube 영상 주소를 입력해 주세요."
          : !rangeOk
            ? "종료 시간은 시작 시간보다 늦어야 해요."
            : null;
      const complete = amount !== null && !error && videoId && s.terms && start !== null && end !== null;
      return {
        details: complete
          ? { type: "VIDEO", amount, videoUrl: s.url.trim(), startSec: start, endSec: end, saveToLibrary: s.saveToLibrary, termsAgreed: true }
          : null,
        amount,
        error,
        summary: [
          { label: "영상", value: videoId ? `youtu.be/${videoId}` : "-" },
          { label: "재생 구간", value: `${s.start} ~ ${s.end}` }
        ],
        chatText: "🎬 영상 후원"
      };
    }
    case "SIGNATURE": {
      const s = states.SIGNATURE;
      const signature = catalog.signatures.find((x) => x.id === s.signatureId) ?? null;
      return {
        details: signature ? { type: "SIGNATURE", signatureId: signature.id, message: s.message.trim() } : null,
        amount: signature?.price ?? null,
        error: null,
        summary: [
          { label: "시그니처", value: signature?.name ?? "-" },
          { label: "메시지", value: s.message.trim() || "메시지 없음" }
        ],
        chatText: `✨ ${signature?.name ?? ""}${s.message.trim() ? ` · ${s.message.trim()}` : ""}`
      };
    }
    case "WISHLIST": {
      const s = states.WISHLIST;
      const item = catalog.wishlist.find((x) => x.id === s.itemId) ?? null;
      return {
        details: item?.inStock ? { type: "WISHLIST", itemId: item.id, message: s.message.trim(), voiceId: s.voiceId } : null,
        amount: item?.price ?? null,
        error: item && !item.inStock ? "선택한 상품은 지금 후원할 수 없어요." : null,
        summary: [
          { label: "위시 상품", value: item ? `${item.emoji} ${item.name}` : "-" },
          { label: "후원 메시지", value: s.message.trim() || "메시지 없음" }
        ],
        chatText: `🎁 ${item?.name ?? ""}`
      };
    }
  }
}

export const isFormKey = (key: DonationTypeKey): key is FormKey => key !== "LUCKYBOX";
