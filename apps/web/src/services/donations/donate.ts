"use server";

import { toDateString } from "@/lib/period";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { enqueueDonationAlert } from "@/services/creator/alertCore";
import { getCreatorById } from "@/services/creators/creators";
import { attributeMemberDonation, isActiveMember, recordBroadcastDonation } from "@/services/crew/crewCore";
import { attributeDonation, ownsNickname, resolveBadges } from "@/services/supporter/identityCore";
import { alertBadgeLabels } from "@/services/supporter/identityTypes";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import type { DonationCatalog } from "./donationCatalog";
import { recordQuest } from "./questCore";
import { canParticipate, enqueueSpin } from "./rouletteCore";
import { canDraw, enqueueDraw } from "./gachaCore";
import { getDonationCatalog, matchSignatureByAmount, signatureImageFor, signatureSoundFor } from "./signatureCore";
import { addDonationDrawing, enqueueDonationVideo } from "@/services/creator/mediaCore";
import { notify } from "@/services/notifications/notificationCore";
import { MAX_DRAWING_CHARS, parseYouTubeId, type DonationResult } from "./donationTypes";

/**
 * Donation Core: one debit path for every donation type (CLAUDE.md §10). Each type only
 * contributes validation and the amount — signature and wishlist prices come from the server catalog.
 *
 * Server Action: re-checks the session, validates input, checks the balance on the server and is
 * idempotent per `idempotencyKey` — a retried or double-submitted request returns the first result.
 * TBD: creator revenue share, platform fee, refunds, delivery to the broadcast platform/overlay.
 */
export async function requestDonation(input: unknown): Promise<DonationResult> {
  if (!USE_MOCK) throw new Error("Donation API is not connected yet.");
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };

  const catalog = getDonationCatalog();
  const parsed = parse(input, catalog);
  if (!parsed) return { status: "INVALID" };
  const creator = await getCreatorById(parsed.creatorId);
  if (!creator) return { status: "NOT_FOUND" };

  const { idempotencyKey, ...request } = parsed;
  const fingerprint = JSON.stringify(request);
  const previous = mockWallet.donationIdempotency[idempotencyKey];
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    return previous.result ?? { status: "IN_PROGRESS" };
  }
  mockWallet.donationIdempotency[idempotencyKey] = { fingerprint, result: null };

  await mockDelay(600);
  let result: DonationResult;
  if (request.type === "ROULETTE" && !canParticipate(creator.id, session.userId, request.amount)) {
    // 룰렛 turned off or today's 참여 가능 횟수 used up since the panel loaded.
    result = { status: "INVALID" };
  } else if (request.type === "GACHA" && !canDraw(creator.id, session.userId, request.details.gachaId as string)) {
    // 뽑기 turned off, sold out (상품소진형) or 1인 횟수 한도 reached since the panel loaded.
    result = { status: "INVALID" };
  } else if (mockAccount.fnBalance < request.amount) {
    result = { status: "INSUFFICIENT_FN", balance: mockAccount.fnBalance, required: request.amount };
  } else {
    // What the alert shows — the same values as the confirm dialog preview (getAlertBadges), resolved
    // before this donation counts. A hidden profile shows 익명 without badges (TBD: final display rules).
    const shown = request.hideProfile ? null : resolveBadges(request.nicknameId, creator.id);
    const donor = shown?.name ?? "익명";
    const badges = shown ? alertBadgeLabels(shown) : [];
    // Debit and record in one step (the backend must do this in a single transaction).
    mockAccount.fnBalance -= request.amount;
    const now = new Date();
    const donationId = `dn-${now.getTime()}`;
    mockWallet.donations.unshift({
      id: donationId,
      donatedAt: `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`,
      creatorId: creator.id,
      creatorName: creator.name,
      message: request.summary,
      fnAmount: request.amount,
      typeLabel: catalog.types.find((t) => t.key === request.type)!.title,
      category: HISTORY_CATEGORY[request.type] ?? "basic",
      status: "COMPLETED"
    });
    attributeDonation(donationId, request.nicknameId);
    if (request.type === "QUEST") {
      const d = request.details as { title: string; timeLimitSec: number; creatorDecides: boolean };
      recordQuest({
        id: donationId,
        channelId: creator.id,
        supporterUserId: session.userId,
        donor,
        donorId: request.hideProfile ? "" : session.funationId,
        title: d.title,
        amount: request.amount,
        timeLimitSec: d.timeLimitSec,
        creatorDecides: d.creatorDecides,
        createdAt: now.toISOString()
      });
    }
    // 룰렛: the result is drawn now and revealed when the wheel spins (no FN prize — 2026-10-04 결정).
    // 뽑기: the prize is drawn now (stock goes down) and played on the 뽑기 overlay (no FN prize).
    if (request.type === "GACHA") enqueueDraw({ id: donationId, channelId: creator.id, supporterUserId: session.userId, donor, gachaId: request.details.gachaId as string });
    if (request.type === "ROULETTE") enqueueSpin({ id: donationId, channelId: creator.id, supporterUserId: session.userId, donor, amount: request.amount });
    attributeMemberDonation(donationId, creator.id, request.memberId, request.amount, { donor, donorId: request.hideProfile ? "" : session.funationId, message: request.summary });
    if (!request.memberId) recordBroadcastDonation(creator.id, { donor, message: request.summary, fnAmount: request.amount });
    enqueueDonationAlert(creator.id, {
      donor,
      badges,
      message: request.summary,
      fnAmount: request.amount,
      // 금액 매칭 (시그니처 관리): a 일반 후원 whose amount equals an AMOUNT-match signature alerts as that signature.
      typeLabel: alertTypeLabel(catalog, request.type, request.amount),
      imageUrl: signatureImageFor(catalog, request.type, request.amount, request.details),
      soundUrl: signatureSoundFor(request.type, request.amount, request.details)
    });
    // 영상 · 그림후원 위젯: paid requests reach the creator's queue / gallery.
    const d = request.details as Record<string, unknown>;
    if (request.type === "VIDEO") enqueueDonationVideo(creator.id, { donor, fnAmount: request.amount, videoId: d.videoId as string, startSec: d.start as number, endSec: d.end as number });
    if (request.type === "DRAWING") addDonationDrawing(creator.id, { donor, title: d.title as string, fnAmount: request.amount, image: d.image as string });
    notify({ kind: "DONATION_SENT", title: "후원을 보냈어요", body: `${creator.name}님께 ${request.amount.toLocaleString("ko-KR")} FN`, href: "/wallet/donations", dedupeKey: `donation:${idempotencyKey}` });
    result = { status: "COMPLETED", donationId, fnAmount: request.amount, balance: mockAccount.fnBalance };
  }
  mockWallet.donationIdempotency[idempotencyKey].result = result;
  return result;
}

function alertTypeLabel(catalog: DonationCatalog, type: string, amount: number) {
  const matched = type === "TEXT" ? matchSignatureByAmount(amount) : null;
  return matched ? `시그니처 · ${matched.name}` : catalog.types.find((t) => t.key === type)!.title;
}

// ── Validation ───────────────────────────────────────────────────────────────

type Parsed = {
  idempotencyKey: string;
  creatorId: string;
  hideProfile: boolean;
  nicknameId: string | null;
  memberId: string | null;
  type: string;
  amount: number;
  /** Text recorded in the donation history. */
  summary: string;
  details: Record<string, unknown>;
};

const MAX_FN = 999_999_999;

/** 후원내역 tabs (632:4): 기본 후원 / 퀘스트 후원 / 게임 후원. */
const HISTORY_CATEGORY: Partial<Record<string, "basic" | "quest" | "game">> = {
  QUEST: "quest",
  ROULETTE: "game",
  GACHA: "game"
};

const isFn = (value: unknown, min = 0): value is number => typeof value === "number" && Number.isInteger(value) && value >= min && value <= MAX_FN;

const isDrawing = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:image/png;base64,") && value.length <= MAX_DRAWING_CHARS;

function parse(input: unknown, catalog: DonationCatalog): Parsed | null {
  if (typeof input !== "object" || input === null) return null;
  const v = input as Record<string, unknown>;
  if (typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.idempotencyKey)) return null;
  if (typeof v.creatorId !== "string" || typeof v.hideProfile !== "boolean") return null;
  const typeInfo = catalog.types.find((t) => t.key === v.type);
  if (!typeInfo?.available) return null;

  // Optional donation nickname (별명): must belong to the supporter; null = the default nickname.
  if (v.nicknameId !== undefined && v.nicknameId !== null && !ownsNickname(v.nicknameId)) return null;
  const nicknameId = typeof v.nicknameId === "string" ? v.nicknameId : null;
  // Optional crew member (크루 멤버 지정): must be an active member of this creator's crew.
  if (v.memberId !== undefined && v.memberId !== null && !isActiveMember(v.creatorId as string, v.memberId)) return null;
  const memberId = typeof v.memberId === "string" ? v.memberId : null;
  const common = { idempotencyKey: v.idempotencyKey, creatorId: v.creatorId, hideProfile: v.hideProfile, nicknameId, memberId, type: typeInfo.key };
  const amountOk = (min: number) => typeof v.amount === "number" && Number.isInteger(v.amount) && v.amount >= min && v.amount <= MAX_FN;
  const text = (value: unknown, max: number, required = false) =>
    typeof value === "string" && value.trim().length <= max && (!required || value.trim().length > 0) ? value.trim() : null;
  const game = catalog.game;
  const voiceOk = (id: unknown) => id === null || (typeof id === "string" && catalog.voices.some((voice) => voice.id === id));

  switch (typeInfo.key) {
    case "TEXT": {
      const message = text(v.message, catalog.maxLength.message);
      if (!amountOk(catalog.minAmount.TEXT) || message === null || !voiceOk(v.voiceId)) return null;
      return { ...common, amount: v.amount as number, summary: message, details: { message, voiceId: v.voiceId } };
    }
    case "MINI": {
      const body = text(v.text, catalog.maxLength.mini, true);
      if (!amountOk(catalog.minAmount.MINI) || body === null || !catalog.miniColors.some((c) => c.id === v.colorId)) return null;
      return { ...common, amount: v.amount as number, summary: body, details: { text: body, colorId: v.colorId } };
    }
    case "VIDEO": {
      const videoId = typeof v.videoUrl === "string" ? parseYouTubeId(v.videoUrl) : null;
      const start = v.startSec;
      const end = v.endSec;
      const rangeOk = Number.isInteger(start) && Number.isInteger(end) && (start as number) >= 0 && (end as number) > (start as number);
      if (!amountOk(catalog.minAmount.VIDEO) || !videoId || !rangeOk || v.termsAgreed !== true) return null;
      return {
        ...common,
        amount: v.amount as number,
        summary: `영상 youtu.be/${videoId}`,
        // 2026-10-04 결정: no video library (no 라이브러리 tab, no 내 라이브러리에 등록).
        details: { videoId, start, end }
      };
    }
    case "SIGNATURE": {
      const signature = catalog.signatures.find((s) => s.id === v.signatureId);
      const message = text(v.message, catalog.maxLength.message);
      if (!signature || message === null) return null;
      return { ...common, amount: signature.price, summary: message || signature.name, details: { signatureId: signature.id, message } };
    }
    case "WISHLIST": {
      const item = catalog.wishlist.find((w) => w.id === v.itemId);
      const message = text(v.message, catalog.maxLength.message);
      if (!item || !item.inStock || message === null || !voiceOk(v.voiceId)) return null;
      return { ...common, amount: item.price, summary: message || item.name, details: { itemId: item.id, message, voiceId: v.voiceId } };
    }
    case "ROULETTE": {
      const roulette = catalog.roulette;
      if (!roulette.enabled || !isFn(v.amount, roulette.minAmount)) return null;
      return { ...common, amount: v.amount as number, summary: "룰렛 참여 1회", details: {} };
    }
    case "GACHA": {
      const offer = catalog.gacha.find((x) => x.id === v.gachaId);
      if (!offer || offer.soldOut || v.termsAgreed !== true) return null;
      return { ...common, amount: offer.price, summary: `${offer.name} 뽑기`, details: { gachaId: offer.id } };
    }
    case "QUEST": {
      const title = text(v.title, game.maxText, true);
      const { successReward } = v;
      // A failed or cancelled quest refunds the whole amount (2026-10-04 결정): no 실패 · 취소 금액.
      const rewardsOk = isFn(successReward, game.minAmount);
      if (!title || !rewardsOk || !timeOk(v.timeLimitSec) || typeof v.creatorDecides !== "boolean" || v.termsAgreed !== true) return null;
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
      return { ...common, amount: v.amount as number, summary: `그림: ${title}`, details: { title, image: v.image, showProcess: v.showProcess, canvasMode: v.canvasMode } };
    }
    default:
      return null;
  }

  function timeOk(value: unknown) {
    return Number.isInteger(value) && (value as number) > 0 && (value as number) <= game.maxTimeSec;
  }

}
