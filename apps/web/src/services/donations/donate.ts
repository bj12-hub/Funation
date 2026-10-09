"use server";

import { randomUUID } from "node:crypto";
import { toDateString } from "@/lib/period";
import { memberKeyOf } from "@/lib/records";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS, currentPersonKey, mockAccount } from "@/services/account/mockStore";
import { accountSince } from "@/services/account/withdrawalCore";
import { donorKeyOf, enqueueDonationAlert } from "@/services/creator/alertCore";
import { matchesContent } from "@/services/creator/assetCore";
import { shownOnStream } from "@/services/creator/donationPageCore";
import { getCreatorById } from "@/services/creators/creators";
import { attributeMemberDonation, isActiveMember, liveBroadcastOf, recordBroadcastDonation } from "@/services/crew/crewCore";
import { MEMBER_NICKNAME_ID, attributeDonation, nicknameChangeable, ownsNickname, resolveBadges } from "@/services/supporter/identityCore";
import { alertBadgeLabels } from "@/services/supporter/identityTypes";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import type { DonationCatalog } from "./donationCatalog";
import { recordQuest } from "./questCore";
import { canParticipate, enqueueSpin } from "./rouletteCore";
import { canDraw, enqueueDraw } from "./gachaCore";
import { getDonationCatalog, matchSignatureByAmount, signatureImageFor, signatureSoundFor } from "./signatureCore";
import { addDonationDrawing, enqueueDonationVideo } from "@/services/creator/mediaCore";
import { MEDIA_LIMITS } from "@/services/creator/mediaTypes";
import { notify } from "@/services/notifications/notificationCore";
import { MAX_DRAWING_CHARS, parseYouTubeId, type DonationResult } from "./donationTypes";

/**
 * Donation Core: one debit path for every donation type (CLAUDE.md §10). Each type only
 * contributes validation and the amount — signature and wishlist prices come from the server catalog.
 *
 * Server Action: re-checks the session, validates input, checks the balance on the server and is
 * idempotent per `idempotencyKey` — a retried or double-submitted request returns the first result, even when the
 * catalog changed since (a new price, a sold-out 뽑기), so a client that lost the answer can always learn it.
 * Supporter-written text (message, 미니 text, quest / drawing title) with a platform forbidden word is refused
 * before anything is debited. Priced types (signature, wishlist, 뽑기) debit the price the supporter confirmed, and
 * only while it is still the creator's price (PRICE_CHANGED otherwise).
 * TBD: creator revenue share, platform fee, refunds, delivery to the broadcast platform/overlay.
 */
export async function requestDonation(input: unknown): Promise<DonationResult> {
  if (!USE_MOCK) throw new Error("Donation API is not connected yet.");
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };

  const v = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : null;
  if (!v || typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.idempotencyKey) || typeof v.creatorId !== "string") return { status: "INVALID" };
  const idempotencyKey = v.idempotencyKey;
  const creator = await getCreatorById(v.creatorId);

  // No await from the lookup to the registration: two copies of one request cannot both pass. Keys belong to the
  // member: another member's key never returns (or blocks) their result.
  const fingerprint = fingerprintOf(v);
  const memberKey = memberKeyOf(session.userId, idempotencyKey);
  const previous = mockWallet.donationIdempotency[memberKey];
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    return previous.result ?? { status: "IN_PROGRESS" };
  }
  if (!creator) return { status: "NOT_FOUND" };
  const catalog = getDonationCatalog();
  const request = parse(v, catalog);
  if (!request) return { status: "INVALID" };
  if ("refused" in request) return { status: "INVALID", message: request.refused };
  // Held by reference: a 재가입 during the await moves the entry to the withdrawn account's own id (account/rejoin.ts).
  const entry: { fingerprint: string; result: DonationResult | null } = (mockWallet.donationIdempotency[memberKey] = { fingerprint, result: null });

  await mockDelay(600);
  // From here to the debit nothing awaits: the checks and the write see the same state.
  let result: DonationResult;
  const price = request.priced ? currentPrice(request.type, request.details) : request.amount;
  // 룰렛 · 뽑기 limits count per person (the verified phone), so a 재가입 the same day does not reset them; the room's
  // 내 룰렛 · 내 뽑기 list the account's own (2026-10-08 결정).
  const player = { supporterUserId: session.userId, account: accountSince(), person: currentPersonKey() };
  if (request.type === "ROULETTE" && !canParticipate(creator.id, player.person, request.amount)) {
    // 룰렛 turned off or today's 참여 가능 횟수 used up since the panel loaded.
    result = { status: "INVALID" };
  } else if (request.type === "GACHA" && !canDraw(creator.id, player.person, request.details.gachaId as string)) {
    // 뽑기 turned off, sold out (상품소진형) or 1인 횟수 한도 reached since the panel loaded.
    result = { status: "INVALID" };
  } else if (price === null) {
    // The signature / wishlist item was removed or went out of stock since the panel loaded.
    result = { status: "INVALID" };
  } else if (price !== request.amount) {
    // The creator changed the price after the supporter confirmed it: nothing is debited.
    result = { status: "PRICE_CHANGED", amount: price };
  } else if (mockAccount.fnBalance < request.amount) {
    result = { status: "INSUFFICIENT_FN", balance: mockAccount.fnBalance, required: request.amount };
  } else {
    // What the alert shows — the same values as the confirm dialog preview (getAlertBadges), resolved
    // before this donation counts. A hidden profile shows 익명 without badges (TBD: final display rules).
    const shown = request.hideProfile ? null : resolveBadges(request.nicknameId, creator.id);
    const donor = shown?.name ?? "익명";
    const badges = shown ? alertBadgeLabels(shown) : [];
    // The name on stream: the creator's 대체 메시지 rules as they are now (the alert below applies the same). Overlays
    // that show the donor from the 룰렛 · 뽑기 and crew records use it; the records keep the original as well.
    const shownDonor = shownOnStream({ donor, message: request.summary }).donor;
    // Debit and record in one step (the backend must do this in a single transaction).
    mockAccount.fnBalance -= request.amount;
    const now = new Date();
    // Unique even for requests finishing in the same millisecond (quest decisions and wallet rows look it up).
    const donationId = `dn-${randomUUID()}`;
    const quest = request.type === "QUEST";
    const donorId = request.hideProfile ? "" : session.ssumnationId;
    mockWallet.donations.unshift({
      id: donationId,
      donatedAt: `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`,
      creatorId: creator.id,
      creatorName: creator.name,
      message: request.summary,
      fnAmount: request.amount,
      typeLabel: catalog.types.find((t) => t.key === request.type)!.title,
      category: HISTORY_CATEGORY[request.type] ?? "basic",
      // A running quest holds the FN (refunded on 실패 · 취소); it completes when the quest succeeds.
      status: quest ? "PROCESSING" : "COMPLETED",
      // Public totals and rankings never count a hidden-profile donation under the member's name.
      hideProfile: request.hideProfile
    });
    // A hidden profile went out as 익명: no 별명 gets it (2026-10-09 결정; it still counts toward the 누적 · 활동 등급).
    if (!request.hideProfile) attributeDonation(donationId, request.nicknameId);
    if (quest) {
      const d = request.details as { title: string; timeLimitSec: number; creatorDecides: boolean };
      recordQuest({
        id: donationId,
        channelId: creator.id,
        supporterUserId: session.userId,
        donor,
        donorId,
        title: d.title,
        amount: request.amount,
        timeLimitSec: d.timeLimitSec,
        creatorDecides: d.creatorDecides,
        createdAt: now.toISOString(),
        // Crew points, member ranking and the 후원 리스트 wait for SUCCESS (questCore.ts); the name on stream is the one
        // its 퀘스트 도착 alert showed (2026-10-09 결정).
        crew: { memberId: request.memberId, broadcastId: liveBroadcastOf(creator.id)?.id ?? null, message: request.summary, shownDonor }
      });
    } else {
      // Crew records keep the name as sent (방송 운영 후원 리스트, 크루 후원) and the name on stream (2026-10-09 결정).
      attributeMemberDonation(donationId, creator.id, request.memberId, request.amount, { donor, donorId, message: request.summary, shownDonor });
      if (!request.memberId) recordBroadcastDonation(creator.id, { donor, shownDonor, message: request.summary, fnAmount: request.amount });
    }
    // 룰렛: the result is drawn now and revealed when the wheel spins (no FN prize — 2026-10-04 결정).
    // 뽑기: the prize is drawn now (stock goes down) and played on the 뽑기 overlay (no FN prize).
    // Their overlays show the name as the alert does (대체 메시지 표시 설정); the records keep the original.
    if (request.type === "GACHA") enqueueDraw({ id: donationId, channelId: creator.id, ...player, donor, shownDonor, gachaId: request.details.gachaId as string, amount: request.amount });
    if (request.type === "ROULETTE") enqueueSpin({ id: donationId, channelId: creator.id, ...player, donor, shownDonor, amount: request.amount });
    enqueueDonationAlert(creator.id, {
      donor,
      // 후원랭킹 groups by this opaque key, never by the (copyable) name; a hidden profile has none.
      donorKey: request.hideProfile ? null : donorKeyOf(creator.id, session.userId),
      badges,
      message: request.summary,
      fnAmount: request.amount,
      // 금액 매칭 (시그니처 관리): a 일반 후원 whose amount equals an AMOUNT-match signature alerts as that signature.
      typeLabel: alertTypeLabel(catalog, request.type, request.amount),
      donationType: request.type,
      imageUrl: signatureImageFor(catalog, request.type, request.amount, request.details),
      soundUrl: signatureSoundFor(request.type, request.amount, request.details),
      // The quest's arrival shows now; its FN counts in the 후원 위젯 once it succeeds.
      ...(quest ? { questId: donationId } : {})
    });
    // 영상 · 그림후원 위젯: paid requests reach the creator's queue / gallery.
    const d = request.details as Record<string, unknown>;
    if (request.type === "VIDEO" || request.type === "AUDIO") {
      enqueueDonationVideo(creator.id, { donor, fnAmount: request.amount, videoId: d.videoId as string, startSec: d.start as number, endSec: d.end as number, mode: request.type });
    }
    if (request.type === "DRAWING") addDonationDrawing(creator.id, { donor, title: d.title as string, fnAmount: request.amount, image: d.image as string });
    notify({ kind: "DONATION_SENT", title: "후원을 보냈어요", body: `${creator.name}님께 ${request.amount.toLocaleString("ko-KR")} FN`, href: "/wallet/donations", dedupeKey: `donation:${idempotencyKey}` });
    result = { status: "COMPLETED", donationId, fnAmount: request.amount, balance: mockAccount.fnBalance };
  }
  entry.result = result;
  return result;
}

function alertTypeLabel(catalog: DonationCatalog, type: string, amount: number) {
  const matched = type === "TEXT" ? matchSignatureByAmount(amount) : null;
  return matched ? `시그니처 · ${matched.name}` : catalog.types.find((t) => t.key === type)!.title;
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * What the supporter sent (key order ignored, the key itself left out), including the price they confirmed — not what
 * the server derived from it, so a retry still matches after the creator renames a signature or changes a price.
 */
const fingerprintOf = (v: Record<string, unknown>) =>
  JSON.stringify(
    Object.entries(v)
      .filter(([k]) => k !== "idempotencyKey")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );

type Parsed = {
  creatorId: string;
  hideProfile: boolean;
  nicknameId: string | null;
  memberId: string | null;
  type: string;
  /** For a priced type: the price the supporter confirmed (checked against the current price before the debit). */
  amount: number;
  /** Signature, wishlist and 뽑기: the price is the creator's, so it is checked again right before the debit. */
  priced: boolean;
  /** Text recorded in the donation history. */
  summary: string;
  details: Record<string, unknown>;
};

/** Same wording as chat, test alerts and the other places that refuse platform forbidden words. */
const FORBIDDEN_MESSAGE = "사용할 수 없는 단어가 포함되어 있어요.";
const hasForbidden = (...texts: string[]) => texts.some((t) => MOCK_FORBIDDEN_WORDS.some((w) => t.toLowerCase().includes(w)));

/** The creator's current price of a signature, wishlist item or 뽑기; null when it is gone (or out of stock). */
function currentPrice(type: string, details: Record<string, unknown>): number | null {
  const catalog = getDonationCatalog();
  if (type === "SIGNATURE") return catalog.signatures.find((s) => s.id === details.signatureId)?.price ?? null;
  if (type === "WISHLIST") {
    const item = catalog.wishlist.find((w) => w.id === details.itemId);
    return item?.inStock ? item.price : null;
  }
  return catalog.gacha.find((x) => x.id === details.gachaId)?.price ?? null;
}

const MAX_FN = 999_999_999;

/** 후원내역 tabs (632:4): 기본 후원 / 퀘스트 후원 / 게임 후원. */
const HISTORY_CATEGORY: Partial<Record<string, "basic" | "quest" | "game">> = {
  QUEST: "quest",
  ROULETTE: "game",
  GACHA: "game"
};

const isFn = (value: unknown, min = 0): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= MAX_FN;

const PNG_DATA_URL = "data:image/png;base64,";
/** A PNG data URL within the size limit: plain base64 whose bytes start with the PNG signature (not just the prefix). */
const isDrawing = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.startsWith(PNG_DATA_URL) || value.length > MAX_DRAWING_CHARS) return false;
  const body = value.slice(PNG_DATA_URL.length);
  return body.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(body) && matchesContent(Buffer.from(body.slice(0, 16), "base64"), "image/png");
};

/** null = malformed; `refused` = well-formed but the text cannot go out (a platform forbidden word). */
function parse(v: Record<string, unknown>, catalog: DonationCatalog): Parsed | { refused: string } | null {
  if (typeof v.creatorId !== "string" || typeof v.hideProfile !== "boolean") return null;
  const typeInfo = catalog.types.find((t) => t.key === v.type);
  if (!typeInfo?.available) return null;

  // Optional donation nickname (별명): must belong to the supporter; null = the default nickname. With the creator's
  // 후원 닉네임 변경 off, the pick is ignored and the donation goes out under the member nickname.
  const changeable = nicknameChangeable();
  if (changeable && v.nicknameId !== undefined && v.nicknameId !== null && !ownsNickname(v.nicknameId)) return null;
  const nicknameId = !changeable ? MEMBER_NICKNAME_ID : typeof v.nicknameId === "string" ? v.nicknameId : null;
  // Optional crew member (크루 멤버 지정): must be an active member of this creator's crew.
  if (v.memberId !== undefined && v.memberId !== null && !isActiveMember(v.creatorId as string, v.memberId)) return null;
  const memberId = typeof v.memberId === "string" ? v.memberId : null;
  const common = { creatorId: v.creatorId, hideProfile: v.hideProfile, nicknameId, memberId, type: typeInfo.key, priced: false };
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
      if (hasForbidden(message)) return refused;
      return { ...common, amount: v.amount as number, summary: message, details: { message, voiceId: v.voiceId } };
    }
    case "MINI": {
      const body = text(v.text, catalog.maxLength.mini, true);
      // 미니 후원 is under 1,000 FN (2026-10-09 결정); larger amounts go as 일반 후원.
      if (!amountOk(catalog.minAmount.MINI, catalog.maxAmount.MINI) || body === null || !catalog.miniColors.some((c) => c.id === v.colorId)) return null;
      if (hasForbidden(body)) return refused;
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
      if (hasForbidden(message)) return refused;
      return { ...common, priced: true, amount: expected, summary: message || signature.name, details: { signatureId: signature.id, message } };
    }
    case "WISHLIST": {
      const item = catalog.wishlist.find((w) => w.id === v.itemId);
      const message = text(v.message, catalog.maxLength.message);
      if (!item || !item.inStock || message === null || !voiceOk(v.voiceId) || expected === null) return null;
      if (hasForbidden(message)) return refused;
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
      if (hasForbidden(title)) return refused;
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
      if (hasForbidden(title)) return refused;
      return { ...common, amount: v.amount as number, summary: `그림: ${title}`, details: { title, image: v.image, showProcess: v.showProcess, canvasMode: v.canvasMode } };
    }
    default:
      return null;
  }

  function timeOk(value: unknown) {
    return Number.isInteger(value) && (value as number) > 0 && (value as number) <= game.maxTimeSec;
  }

}
