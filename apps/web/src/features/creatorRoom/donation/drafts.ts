import { formatNumber } from "@/lib/format";
import { messagesFor, translate, type MessageKey } from "@/lib/i18n/translate";
import type { DonationCatalog, DonationTypeKey } from "@/services/donations/donationCatalog";
import { parseYouTubeId, type DonationDetails } from "@/services/donations/donationTypes";

/**
 * Form state per donation type and the pure step that turns it into a request.
 * The browser checks only what it needs for feedback; the server validates everything again and
 * owns prices (signature / wishlist / 뽑기 amounts shown here are the server's catalog values, sent back as
 * `expectedAmount` so a price changed meanwhile is refused instead of charged).
 */

/** `readAloud`: only where the catalog offers the choice (`readAloudChoice`). */
export type TextState = { amount: string; message: string; voiceId: string | null; readAloud: boolean };
export type MiniState = { amount: string; text: string; colorId: string; enterToSend: boolean };
export type VideoState = { amount: string; url: string; start: string; end: string; terms: boolean };
export type SignatureState = { signatureId: string | null; message: string; readAloud: boolean };
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
  /** 음성 후원: the same fields as 영상 (link, range, terms). */
  AUDIO: VideoState;
  SIGNATURE: SignatureState;
  WISHLIST: WishlistState;
  ROULETTE: RouletteState;
  QUEST: QuestState;
  DRAWING: DrawingState;
  GACHA: GachaState;
};

export type FormKey = keyof FormStates;

/** `t` from useI18n: errors, confirm rows and button labels follow the viewer's language. Korean by default. */
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
const korean: Translate = (key, vars) => translate(messagesFor("ko"), key, vars);

export function initialStates(catalog: DonationCatalog): FormStates {
  const voiceId = catalog.voices[0]?.id ?? null;
  return {
    TEXT: { amount: "", message: "", voiceId, readAloud: true },
    MINI: { amount: "", text: "", colorId: catalog.miniColors[1]?.id ?? catalog.miniColors[0]?.id ?? "", enterToSend: true },
    VIDEO: { amount: "", url: "", start: "00:00", end: "00:30", terms: false },
    AUDIO: { amount: "", url: "", start: "00:00", end: "00:30", terms: false },
    SIGNATURE: { signatureId: null, message: "", readAloud: true },
    WISHLIST: { itemId: null, message: "", voiceId },
    // 펀페이 1009:510: the 참여 금액 starts at the minimum.
    ROULETTE: { amount: String(catalog.roulette.minAmount), limitReached: false },
    QUEST: { title: "", success: "", time: { minutes: "10", seconds: "00" }, creatorDecides: true, terms: false },
    DRAWING: { amount: "", title: "", image: null, showProcess: true, canvasMode: false, terms: false },
    GACHA: { gachaId: catalog.gacha.find((x) => !x.soldOut)?.id ?? catalog.gacha[0]?.id ?? null, terms: false, limitReached: false }
  };
}

/** The confirm step's "메시지 읽어주기" row, where the room offers the choice and there is a message to read. */
const readAloudRow = (catalog: DonationCatalog, s: { message: string; readAloud: boolean }, t: Translate) =>
  catalog.readAloudChoice && s.message.trim() ? [{ label: t("roomDonate.readAloud"), value: t(s.readAloud ? "roomDonate.readAloudOn" : "roomDonate.readAloudOff") }] : [];

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

/** 빠른 금액 추가 (funnation 참고, 2026-10-06 결정): each button adds to what is typed; 전액 sets the balance. */
export const QUICK_AMOUNTS: { add: number; label: string }[] = [
  { add: 1_000, label: "+1천" },
  { add: 5_000, label: "+5천" },
  { add: 10_000, label: "+1만" },
  { add: 50_000, label: "+5만" },
  { add: 100_000, label: "+10만" }
];
/** The amount input keeps 9 digits. */
export const AMOUNT_INPUT_MAX = 999_999_999;

/** `current` (digits or "") plus `add`, as the digits the amount input holds (capped at the input's 9 digits). */
export function addAmount(current: string, add: number): string {
  const base = current ? Number(current) : 0;
  return String(Math.min(AMOUNT_INPUT_MAX, (Number.isFinite(base) ? base : 0) + add));
}

export function buildDraft(key: FormKey, states: FormStates, catalog: DonationCatalog, t: Translate = korean): Draft {
  switch (key) {
    case "TEXT": {
      const s = states.TEXT;
      const amount = digits(s.amount);
      const min = catalog.minAmount.TEXT;
      const tooSmall = amount !== null && amount < min;
      return {
        details:
          amount !== null && !tooSmall
            ? { type: "TEXT", amount, message: s.message.trim(), voiceId: s.voiceId, ...(catalog.readAloudChoice ? { readAloud: s.readAloud } : {}) }
            : null,
        amount,
        error: tooSmall ? t("roomDonate.minAmount", { amount: formatNumber(min) }) : null,
        summary: [{ label: t("roomDonate.message"), value: s.message.trim() || t("roomDonate.noMessage") }, ...readAloudRow(catalog, s, t)],
        chatText: s.message.trim()
      };
    }
    case "MINI": {
      const s = states.MINI;
      const amount = digits(s.amount);
      const min = catalog.minAmount.MINI;
      const max = catalog.maxAmount.MINI;
      const tooSmall = amount !== null && amount < min;
      const tooLarge = amount !== null && amount > max;
      const text = s.text.trim();
      return {
        details: amount !== null && !tooSmall && !tooLarge && text ? { type: "MINI", amount, text, colorId: s.colorId } : null,
        amount,
        error: tooSmall
          ? t("roomDonate.minAmount", { amount: formatNumber(min) })
          : tooLarge
            ? t("roomDonate.miniMax", { max: formatNumber(max), next: formatNumber(max + 1) })
            : null,
        summary: [{ label: t("roomDonate.miniText"), value: text }],
        chatText: `⚡ ${text}`
      };
    }
    case "VIDEO":
    case "AUDIO": {
      const audio = key === "AUDIO";
      const s = states[key];
      const min = audio ? catalog.minAmount.AUDIO : catalog.minAmount.VIDEO;
      const videoId = s.url ? parseYouTubeId(s.url) : null;
      const start = parseClock(s.start);
      const end = parseClock(s.end);
      const rangeOk = start !== null && end !== null && end > start;
      // Priced by the second (a FLEXTV streamer's 영상 후원): the length sets the amount, within the streamer's limit.
      const pricing = catalog.mediaPricing?.[key];
      const length = rangeOk ? end - start : null;
      const amount = pricing ? (length === null ? null : length * pricing.perSecond) : digits(s.amount);
      const tooSmall = amount !== null && amount < min;
      const tooLong = !!pricing && length !== null && length > pricing.maxSec;
      const error = tooLong
        ? t("roomDonate.maxSeconds", { max: formatNumber(pricing.maxSec) })
        : tooSmall
          ? t(pricing ? "roomDonate.minAmountLonger" : "roomDonate.minAmount", { amount: formatNumber(min) })
          : s.url && !videoId
            ? t("roomDonate.youtubeOnly")
            : !rangeOk
              ? t("roomDonate.rangeError")
              : null;
      const complete = amount !== null && !error && videoId && s.terms && start !== null && end !== null;
      return {
        details: complete
          ? { type: key, amount, videoUrl: s.url.trim(), startSec: start, endSec: end, termsAgreed: true }
          : null,
        amount,
        error,
        summary: [
          { label: audio ? t("roomDonate.rowAudio") : t("roomDonate.rowVideo"), value: videoId ? `youtu.be/${videoId}` : "-" },
          { label: t("roomDonate.rowRange"), value: `${s.start} ~ ${s.end}` }
        ],
        chatText: audio ? t("roomDonate.chatAudio") : t("roomDonate.chatVideo")
      };
    }
    case "SIGNATURE": {
      const s = states.SIGNATURE;
      const signature = catalog.signatures.find((x) => x.id === s.signatureId) ?? null;
      return {
        details: signature
          ? { type: "SIGNATURE", signatureId: signature.id, message: s.message.trim(), expectedAmount: signature.price, ...(catalog.readAloudChoice ? { readAloud: s.readAloud } : {}) }
          : null,
        amount: signature?.price ?? null,
        error: null,
        summary: [
          { label: t("roomDonate.rowSignature"), value: signature?.name ?? "-" },
          { label: t("roomDonate.shortMessage"), value: s.message.trim() || t("roomDonate.noMessage") },
          ...readAloudRow(catalog, s, t)
        ],
        chatText: `✨ ${signature?.name ?? ""}${s.message.trim() ? ` · ${s.message.trim()}` : ""}`
      };
    }
    case "WISHLIST": {
      const s = states.WISHLIST;
      const item = catalog.wishlist.find((x) => x.id === s.itemId) ?? null;
      return {
        details: item?.inStock ? { type: "WISHLIST", itemId: item.id, message: s.message.trim(), voiceId: s.voiceId, expectedAmount: item.price } : null,
        amount: item?.price ?? null,
        error: item && !item.inStock ? t("roomDonate.notAvailable") : null,
        summary: [
          { label: t("roomDonate.rowWish"), value: item ? `${item.emoji} ${item.name}` : "-" },
          { label: t("roomDonate.message"), value: s.message.trim() || t("roomDonate.noMessage") }
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
          ? t("roomDonate.limitUsed")
          : amount !== null && amount < r.minAmount
            ? t("roomDonate.rouletteMin", { amount: formatNumber(r.minAmount) })
            : null;
      const ok = r.enabled && amount !== null && error === null;
      return {
        details: ok ? { type: "ROULETTE", amount } : null,
        amount: ok ? amount : null,
        error,
        summary: [
          { label: t("roomDonate.rowRoulette"), value: t("roomDonate.onePlay") },
          { label: t("roomDonate.rowPrize"), value: t("roomDonate.creatorPrize") }
        ],
        chatText: t("roomDonate.chatRoulette"),
        buttonLabel: r.enabled ? t("roomDonate.joinWith", { amount: formatNumber(amount ?? r.minAmount) }) : t("roomDonate.rouletteOff")
      };
    }
    case "GACHA": {
      const s = states.GACHA;
      const offer = catalog.gacha.find((x) => x.id === s.gachaId) ?? null;
      const error = !offer ? null : offer.soldOut ? t("roomDonate.soldOutError") : s.limitReached ? t("roomDonate.gachaLimit") : null;
      const ok = offer !== null && error === null && s.terms;
      return {
        details: ok ? { type: "GACHA", gachaId: offer.id, termsAgreed: true, expectedAmount: offer.price } : null,
        amount: ok ? offer.price : null,
        error,
        summary: [
          { label: t("roomDonate.rowGacha"), value: offer?.name ?? "-" },
          { label: t("roomDonate.rowPrize"), value: t("roomDonate.creatorPrize") }
        ],
        chatText: t("roomDonate.chatGacha", { name: offer?.name ?? "" }),
        buttonLabel: offer ? t("roomDonate.gachaButton", { name: offer.name, amount: formatNumber(offer.price) }) : t("roomDonate.noGacha")
      };
    }
    case "QUEST": {
      const s = states.QUEST;
      const success = digits(s.success);
      const time = timeToSec(s.time);
      const title = s.title.trim();
      const error =
        success !== null && success < catalog.game.minAmount
          ? t("roomDonate.questMin", { amount: formatNumber(catalog.game.minAmount) })
          : time === null || time > catalog.game.maxTimeSec
            ? t("roomDonate.checkTime")
            : null;
      const ready = title && success !== null && time !== null && !error && s.terms;
      return {
        details: ready
          ? { type: "QUEST", title, successReward: success, timeLimitSec: time, creatorDecides: s.creatorDecides, termsAgreed: true }
          : null,
        amount: success,
        error,
        summary: [
          { label: t("roomDonate.rowQuest"), value: title || "-" },
          { label: t("roomDonate.rowFail"), value: t("roomDonate.fullRefund") },
          { label: t("roomDonate.timeLimit"), value: t("roomDonate.timeValue", { m: s.time.minutes || "0", s: s.time.seconds || "0" }) }
        ],
        chatText: t("roomDonate.chatQuest", { title }),
        buttonLabel: t("roomDonate.questButton", { amount: formatNumber(success ?? 0) })
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
        error: tooSmall ? t("roomDonate.minAmount", { amount: formatNumber(catalog.game.minAmount) }) : null,
        summary: [{ label: t("roomDonate.drawingTitle"), value: title || "-" }],
        chatText: `🎨 ${title}`,
        buttonLabel: t("roomDonate.drawingButton", { amount: formatNumber(amount ?? 0) })
      };
    }
  }
}

const FORM_KEYS: Record<FormKey, true> = {
  TEXT: true,
  MINI: true,
  VIDEO: true,
  AUDIO: true,
  SIGNATURE: true,
  WISHLIST: true,
  ROULETTE: true,
  QUEST: true,
  DRAWING: true,
  GACHA: true
};

export const isFormKey = (key: DonationTypeKey): key is FormKey => key in FORM_KEYS;
