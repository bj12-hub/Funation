import { matchesContent } from "@/services/creator/assetCore";
import { MEDIA_LIMITS } from "@/services/creator/mediaTypes";
import type { DonationCatalog, DonationTypeKey } from "./donationCatalog";
import { MAX_DRAWING_CHARS, parseYouTubeId } from "./donationTypes";

/**
 * Donation Core's per-type rules (CLAUDE.md §10): what each type takes, checked against the catalog of the room it goes
 * to — the mock creator's (./donate.ts) or a FLEXTV channel's (./flextvDonate.ts, phase 6). Server-only (it reads
 * the drawing's bytes).
 */

export type ParsedDetails = {
  type: DonationTypeKey;
  /** For a priced type: the price the supporter confirmed (checked against the current price before the debit). */
  amount: number;
  /** Signature, wishlist and 뽑기: the price is the creator's, so it is checked again right before the debit. */
  priced: boolean;
  /** Text recorded in the donation history. */
  summary: string;
  details: Record<string, unknown>;
};

/** Same wording as chat, test alerts and the other places that refuse platform forbidden words. */
export const FORBIDDEN_MESSAGE = "사용할 수 없는 단어가 포함되어 있어요.";

const MAX_FN = 999_999_999;

const isFn = (value: unknown, min = 0): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= MAX_FN;

const PNG_DATA_URL = "data:image/png;base64,";
/** A PNG data URL within the size limit: plain base64 whose bytes start with the PNG signature (not just the prefix). */
const isDrawing = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.startsWith(PNG_DATA_URL) || value.length > MAX_DRAWING_CHARS) return false;
  const body = value.slice(PNG_DATA_URL.length);
  return body.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(body) && matchesContent(Buffer.from(body.slice(0, 16), "base64"), "image/png");
};

/**
 * null = malformed or a type the room does not offer; `refused` = well-formed but the text cannot go out (a forbidden
 * word, as `forbidden` tells).
 */
export function parseDetails(v: Record<string, unknown>, catalog: DonationCatalog, forbidden: (...texts: string[]) => boolean): ParsedDetails | { refused: string } | null {
  const typeInfo = catalog.types.find((t) => t.key === v.type);
  if (!typeInfo?.available) return null;
  const common = { type: typeInfo.key, priced: false };
  const amountOk = (min: number, max = MAX_FN) => typeof v.amount === "number" && Number.isInteger(v.amount) && v.amount >= min && v.amount <= max;
  const text = (value: unknown, max: number, required = false) =>
    typeof value === "string" && value.trim().length <= max && (!required || value.trim().length > 0) ? value.trim() : null;
  const game = catalog.game;
  const voiceOk = (id: unknown) => id === null || (typeof id === "string" && catalog.voices.some((voice) => voice.id === id));
  // Priced types: the price the supporter confirmed (any FN amount; it must equal the creator's price at the debit).
  const expected = isFn(v.expectedAmount, 1) ? v.expectedAmount : null;
  const refused = { refused: FORBIDDEN_MESSAGE };

  // Supporter-written text goes on stream (alert · TTS · quest widget · drawing gallery): checked before any debit.
  switch (typeInfo.key) {
    case "TEXT": {
      const message = text(v.message, catalog.maxLength.message);
      if (!amountOk(catalog.minAmount.TEXT) || message === null || !voiceOk(v.voiceId)) return null;
      if (forbidden(message)) return refused;
      return { ...common, amount: v.amount as number, summary: message, details: { message, voiceId: v.voiceId } };
    }
    case "MINI": {
      const body = text(v.text, catalog.maxLength.mini, true);
      // 미니 후원 is under 1,000 FN (2026-10-09 결정); larger amounts go as 일반 후원.
      if (!amountOk(catalog.minAmount.MINI, catalog.maxAmount.MINI) || body === null || !catalog.miniColors.some((c) => c.id === v.colorId)) return null;
      if (forbidden(body)) return refused;
      return { ...common, amount: v.amount as number, summary: body, details: { text: body, colorId: v.colorId } };
    }
    case "VIDEO":
    case "AUDIO": {
      // 음성 후원 takes the same link and range as 영상 후원; only how it plays differs (sound, small player).
      const audio = typeInfo.key === "AUDIO";
      const videoId = typeof v.videoUrl === "string" ? parseYouTubeId(v.videoUrl) : null;
      const start = v.startSec;
      const end = v.endSec;
      // Same bounds as the 테스트 영상 (0 … 24 hours).
      const rangeOk = Number.isInteger(start) && Number.isInteger(end) && (start as number) >= 0 && (end as number) > (start as number) && (end as number) <= MEDIA_LIMITS.rangeSecMax;
      if (!amountOk(audio ? catalog.minAmount.AUDIO : catalog.minAmount.VIDEO) || !videoId || !rangeOk || v.termsAgreed !== true) return null;
      // A room that prices by the second (FLEXTV's 영상 후원): the amount is the length × the price, within its limit.
      const pricing = catalog.mediaPricing?.[typeInfo.key];
      const length = (end as number) - (start as number);
      if (pricing && (length > pricing.maxSec || v.amount !== length * pricing.perSecond)) return null;
      return {
        ...common,
        amount: v.amount as number,
        summary: `${audio ? "음성" : "영상"} youtu.be/${videoId}`,
        // 2026-10-04 결정: no video library (no 라이브러리 tab, no 내 라이브러리에 등록).
        details: { videoId, start, end }
      };
    }
    case "SIGNATURE": {
      const signature = catalog.signatures.find((s) => s.id === v.signatureId);
      const message = text(v.message, catalog.maxLength.message);
      if (!signature || message === null || expected === null) return null;
      if (forbidden(message)) return refused;
      return { ...common, priced: true, amount: expected, summary: message || signature.name, details: { signatureId: signature.id, message } };
    }
    case "WISHLIST": {
      const item = catalog.wishlist.find((w) => w.id === v.itemId);
      const message = text(v.message, catalog.maxLength.message);
      if (!item || !item.inStock || message === null || !voiceOk(v.voiceId) || expected === null) return null;
      if (forbidden(message)) return refused;
      return { ...common, priced: true, amount: expected, summary: message || item.name, details: { itemId: item.id, message, voiceId: v.voiceId } };
    }
    case "ROULETTE": {
      const roulette = catalog.roulette;
      if (!roulette.enabled || !isFn(v.amount, roulette.minAmount)) return null;
      return { ...common, amount: v.amount as number, summary: "룰렛 참여 1회", details: {} };
    }
    case "GACHA": {
      const offer = catalog.gacha.find((x) => x.id === v.gachaId);
      if (!offer || offer.soldOut || v.termsAgreed !== true || expected === null) return null;
      return { ...common, priced: true, amount: expected, summary: `${offer.name} 뽑기`, details: { gachaId: offer.id } };
    }
    case "QUEST": {
      const title = text(v.title, game.maxText, true);
      const { successReward } = v;
      // A failed or cancelled quest refunds the whole amount (2026-10-04 결정): no 실패 · 취소 금액.
      const rewardsOk = isFn(successReward, game.minAmount);
      if (!title || !rewardsOk || !timeOk(v.timeLimitSec) || typeof v.creatorDecides !== "boolean" || v.termsAgreed !== true) return null;
      if (forbidden(title)) return refused;
      return {
        ...common,
        amount: successReward,
        summary: `퀘스트: ${title}`,
        details: { title, successReward, timeLimitSec: v.timeLimitSec, creatorDecides: v.creatorDecides }
      };
    }
    case "DRAWING": {
      const title = text(v.title, game.maxText, true);
      if (!amountOk(game.minAmount) || !title || !isDrawing(v.image) || typeof v.showProcess !== "boolean" || typeof v.canvasMode !== "boolean" || v.termsAgreed !== true)
        return null;
      if (forbidden(title)) return refused;
      return { ...common, amount: v.amount as number, summary: `그림: ${title}`, details: { title, image: v.image, showProcess: v.showProcess, canvasMode: v.canvasMode } };
    }
    default:
      return null;
  }

  function timeOk(value: unknown) {
    return Number.isInteger(value) && (value as number) > 0 && (value as number) <= game.maxTimeSec;
  }
}
