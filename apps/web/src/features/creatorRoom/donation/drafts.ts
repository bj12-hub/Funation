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
export type VideoState = { amount: string; url: string; start: string; end: string; terms: boolean };
export type SignatureState = { signatureId: string | null; message: string };
export type WishlistState = { itemId: string | null; message: string; voiceId: string | null };

/** `limitReached` comes from the room's 룰렛 status (today's 참여 가능 횟수); the server checks again. */
export type RouletteState = { amount: string; limitReached: boolean };
/** `limitReached` comes from the room's 뽑기 status (1인 횟수 한도 for the chosen 뽑기); the server checks again. */
export type GachaState = { gachaId: string | null; terms: boolean; limitReached: boolean };
/** Time limits are typed as minutes + seconds (867:* "10분 00초"). */
export type TimeLimit = { minutes: string; seconds: string };
export type QuestState = { title: string; success: string; time: TimeLimit; creatorDecides: boolean; terms: boolean };
export type DrawingState = { amount: string; title: string; image: string | null; showProcess: boolean; canvasMode: boolean; terms: boolean };

export type FormStates = {
  TEXT: TextState;
  MINI: MiniState;
  VIDEO: VideoState;
  SIGNATURE: SignatureState;
  WISHLIST: WishlistState;
  ROULETTE: RouletteState;
  QUEST: QuestState;
  DRAWING: DrawingState;
  GACHA: GachaState;
};

export type FormKey = keyof FormStates;

export function initialStates(catalog: DonationCatalog): FormStates {
  const voiceId = catalog.voices[0]?.id ?? null;
  return {
    TEXT: { amount: "", message: "", voiceId },
    MINI: { amount: "", text: "", colorId: catalog.miniColors[1]?.id ?? catalog.miniColors[0]?.id ?? "", enterToSend: true },
    VIDEO: { amount: "", url: "", start: "00:00", end: "00:30", terms: false },
    SIGNATURE: { signatureId: null, message: "" },
    WISHLIST: { itemId: null, message: "", voiceId },
    // 펀페이 1009:510: the 참여 금액 starts at the minimum.
    ROULETTE: { amount: String(catalog.roulette.minAmount), limitReached: false },
    QUEST: { title: "", success: "", time: { minutes: "10", seconds: "00" }, creatorDecides: true, terms: false },
    DRAWING: { amount: "", title: "", image: null, showProcess: true, canvasMode: false, terms: false },
    GACHA: { gachaId: catalog.gacha.find((x) => !x.soldOut)?.id ?? catalog.gacha[0]?.id ?? null, terms: false, limitReached: false }
  };
}

/** Minutes + seconds → seconds, or null when not a valid positive time. */
export function timeToSec(time: TimeLimit): number | null {
  const m = Number(time.minutes || "0");
  const s = Number(time.seconds || "0");
  if (!Number.isInteger(m) || !Number.isInteger(s) || s > 59 || m < 0 || s < 0) return null;
  const total = m * 60 + s;
  return total > 0 ? total : null;
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
  /** Submit label when the type has its own (e.g. "뽑기 후원 3,000 FN 뽑기"). */
  buttonLabel?: string;
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
          ? { type: "VIDEO", amount, videoUrl: s.url.trim(), startSec: start, endSec: end, termsAgreed: true }
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
    case "ROULETTE": {
      const r = catalog.roulette;
      const s = states.ROULETTE;
      const amount = s.amount ? Number(s.amount) : null;
      const error = !r.enabled
        ? null
        : s.limitReached
          ? "오늘 참여 가능 횟수를 모두 사용했어요."
          : amount !== null && amount < r.minAmount
            ? `${formatNumber(r.minAmount)} FN 이상이어야 참여할 수 있어요.`
            : null;
      const ok = r.enabled && amount !== null && error === null;
      return {
        details: ok ? { type: "ROULETTE", amount } : null,
        amount: ok ? amount : null,
        error,
        summary: [
          { label: "룰렛", value: "참여 1회" },
          { label: "당첨", value: "크리에이터 상품 (FN 지급 없음)" }
        ],
        chatText: "🎡 룰렛 참여",
        buttonLabel: r.enabled ? `${formatNumber(amount ?? r.minAmount)} FN으로 참여하기` : "룰렛이 꺼져 있어요"
      };
    }
    case "GACHA": {
      const s = states.GACHA;
      const offer = catalog.gacha.find((x) => x.id === s.gachaId) ?? null;
      const error = !offer ? null : offer.soldOut ? "상품이 모두 소진됐어요." : s.limitReached ? "오늘 이 뽑기의 참여 한도를 모두 사용했어요." : null;
      const ok = offer !== null && error === null && s.terms;
      return {
        details: ok ? { type: "GACHA", gachaId: offer.id, termsAgreed: true } : null,
        amount: ok ? offer.price : null,
        error,
        summary: [
          { label: "뽑기", value: offer?.name ?? "-" },
          { label: "당첨", value: "크리에이터 상품 (FN 지급 없음)" }
        ],
        chatText: `🧸 ${offer?.name ?? ""} 뽑기`,
        buttonLabel: offer ? `${offer.name} ${formatNumber(offer.price)} FN 뽑기` : "진행 중인 뽑기가 없어요"
      };
    }
    case "QUEST": {
      const s = states.QUEST;
      const success = digits(s.success);
      const time = timeToSec(s.time);
      const title = s.title.trim();
      const error =
        success !== null && success < catalog.game.minAmount
          ? `성공 보상은 ${formatNumber(catalog.game.minAmount)} FN 이상이어야 해요.`
          : time === null || time > catalog.game.maxTimeSec
            ? "제한 시간을 확인해 주세요."
            : null;
      const ready = title && success !== null && time !== null && !error && s.terms;
      return {
        details: ready
          ? { type: "QUEST", title, successReward: success, timeLimitSec: time, creatorDecides: s.creatorDecides, termsAgreed: true }
          : null,
        amount: success,
        error,
        summary: [
          { label: "퀘스트", value: title || "-" },
          { label: "실패 · 취소 시", value: "전액 환불" },
          { label: "제한 시간", value: `${s.time.minutes || "0"}분 ${s.time.seconds || "0"}초` }
        ],
        chatText: `🏆 퀘스트: ${title}`,
        buttonLabel: `퀘스트 ${formatNumber(success ?? 0)} FN 후원하기`
      };
    }
    case "DRAWING": {
      const s = states.DRAWING;
      const amount = digits(s.amount);
      const tooSmall = amount !== null && amount < catalog.game.minAmount;
      const title = s.title.trim();
      return {
        details:
          amount !== null && !tooSmall && title && s.image && s.terms
            ? { type: "DRAWING", amount, title, image: s.image, showProcess: s.showProcess, canvasMode: s.canvasMode, termsAgreed: true }
            : null,
        amount,
        error: tooSmall ? `최소 ${formatNumber(catalog.game.minAmount)} FN부터 후원할 수 있어요` : null,
        summary: [{ label: "그림 제목", value: title || "-" }],
        chatText: `🎨 ${title}`,
        buttonLabel: `그림 후원 ${formatNumber(amount ?? 0)} FN 보내기`
      };
    }
  }
}

const FORM_KEYS: Record<FormKey, true> = {
  TEXT: true,
  MINI: true,
  VIDEO: true,
  SIGNATURE: true,
  WISHLIST: true,
  ROULETTE: true,
  QUEST: true,
  DRAWING: true,
  GACHA: true
};

export const isFormKey = (key: DonationTypeKey): key is FormKey => key in FORM_KEYS;
