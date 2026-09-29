"use server";

import { toDateString } from "@/lib/period";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { enqueueDonationAlert } from "@/services/creator/alertCore";
import { getCreatorById } from "@/services/creators/creators";
import { attributeMemberDonation, isActiveMember, recordBroadcastDonation } from "@/services/crew/crewCore";
import { attributeDonation, ownsNickname } from "@/services/supporter/identityCore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { luckyTierFor, type DonationCatalog } from "./donationCatalog";
import { getDonationCatalog, matchSignatureByAmount } from "./signatureCore";
import { addDonationDrawing, enqueueDonationVideo } from "@/services/creator/mediaCore";
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
  if (!(await getSession())) return { status: "UNAUTHORIZED" };

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
  if (mockAccount.fnBalance < request.amount) {
    result = { status: "INSUFFICIENT_FN", balance: mockAccount.fnBalance, required: request.amount };
  } else {
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
    attributeMemberDonation(donationId, creator.id, request.memberId, request.amount);
    if (!request.memberId) recordBroadcastDonation(creator.id, { donor: request.hideProfile ? "익명" : mockAccount.nickname, message: request.summary, fnAmount: request.amount });
    // Alert delivery (TBD: donor display name rules — anonymous, 별명, hidden profile).
    enqueueDonationAlert(creator.id, {
      donor: request.hideProfile ? "익명" : mockAccount.nickname,
      message: request.summary,
      fnAmount: request.amount,
      // 금액 매칭 (시그니처 관리): a 일반 후원 whose amount equals an AMOUNT-match signature alerts as that signature.
      typeLabel: alertTypeLabel(catalog, request.type, request.amount)
    });
    // 영상 · 그림후원 위젯: paid requests reach the creator's queue / gallery.
    const donor = request.hideProfile ? "익명" : mockAccount.nickname;
    const d = request.details as Record<string, unknown>;
    if (request.type === "VIDEO") enqueueDonationVideo(creator.id, { donor, fnAmount: request.amount, videoId: d.videoId as string, startSec: d.start as number, endSec: d.end as number });
    if (request.type === "DRAWING") addDonationDrawing(creator.id, { donor, title: d.title as string, fnAmount: request.amount, image: d.image as string });
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
  QUIZ_CHOICE: "game",
  QUIZ_INITIAL: "game",
  QUIZ_DRAWING: "game"
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
      if (!amountOk(catalog.minAmount.VIDEO) || !videoId || !rangeOk || v.termsAgreed !== true || typeof v.saveToLibrary !== "boolean") return null;
      return {
        ...common,
        amount: v.amount as number,
        summary: `영상 youtu.be/${videoId}`,
        details: { videoId, start, end, saveToLibrary: v.saveToLibrary }
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
    case "LUCKYBOX": {
      const lucky = catalog.luckyBox;
      const boxes = v.boxCount;
      const winners = v.winnerCount;
      const amount = v.amount;
      const amountValid = typeof amount === "number" && Number.isInteger(amount) && amount >= lucky.minAmount && amount <= lucky.maxAmount;
      const boxesValid = Number.isInteger(boxes) && (boxes as number) >= lucky.minBoxes && (boxes as number) <= lucky.maxBoxes;
      const winnersValid = Number.isInteger(winners) && (winners as number) >= 1 && (winners as number) <= (boxes as number);
      if (!amountValid || !boxesValid || !winnersValid || v.termsAgreed !== true) return null;
      const tier = luckyTierFor(lucky, amount);
      return {
        ...common,
        amount,
        summary: `${tier.label} BOX · 박스 ${boxes}개 · 당첨 ${winners}개`,
        details: { tier: tier.key, boxCount: boxes, winnerCount: winners }
      };
    }
    case "ROULETTE": {
      const tier = catalog.roulette.tiers.find((t) => t.key === v.tierKey);
      if (!tier) return null;
      return { ...common, amount: tier.amount, summary: `${tier.label} 룰렛`, details: { tierKey: tier.key } };
    }
    case "QUEST": {
      const title = text(v.title, game.maxText, true);
      const { successReward, failAmount, cancelAmount } = v;
      // TBD: what happens to the difference on failure or cancel (refund policy).
      const rewardsOk =
        isFn(successReward, game.minAmount) && isFn(failAmount) && isFn(cancelAmount) && failAmount <= successReward && cancelAmount <= successReward;
      if (!title || !rewardsOk || !timeOk(v.timeLimitSec) || typeof v.creatorDecides !== "boolean" || v.termsAgreed !== true) return null;
      return {
        ...common,
        amount: successReward,
        summary: `퀘스트: ${title}`,
        details: { title, successReward, failAmount, cancelAmount, timeLimitSec: v.timeLimitSec, creatorDecides: v.creatorDecides }
      };
    }
    case "DRAWING": {
      const title = text(v.title, game.maxText, true);
      if (!amountOk(game.minAmount) || !title || !isDrawing(v.image) || typeof v.showProcess !== "boolean" || typeof v.canvasMode !== "boolean" || v.termsAgreed !== true)
        return null;
      return { ...common, amount: v.amount as number, summary: `그림: ${title}`, details: { title, image: v.image, showProcess: v.showProcess, canvasMode: v.canvasMode } };
    }
    case "QUIZ_CHOICE": {
      const question = text(v.question, game.maxText, true);
      const options = Array.isArray(v.options) ? v.options.map((o) => text(o, game.maxText, true)) : [];
      const optionsOk = options.length >= game.quizOptions.min && options.length <= game.quizOptions.max && options.every((o) => o);
      const indexOk = Number.isInteger(v.correctIndex) && (v.correctIndex as number) >= 0 && (v.correctIndex as number) < options.length;
      const rewards = quizRewards(v);
      if (!question || !optionsOk || !indexOk || !rewards) return null;
      return { ...common, amount: rewards.amount, summary: `객관식 퀴즈: ${question}`, details: { question, options, correctIndex: v.correctIndex, ...rewards.details } };
    }
    case "QUIZ_INITIAL": {
      const question = text(v.question, game.maxText, true);
      const answer = text(v.answer, game.maxText, true);
      const hint = text(v.hint, game.maxText);
      const rewards = quizRewards(v);
      if (!question || !answer || hint === null || !rewards) return null;
      return { ...common, amount: rewards.amount, summary: `초성 퀴즈: ${question}`, details: { question, answer, hint, ...rewards.details } };
    }
    case "QUIZ_DRAWING": {
      const question = text(v.question, game.maxText, true);
      const answer = text(v.answer, game.maxText, true);
      const rewards = quizRewards(v);
      if (!question || !answer || !isDrawing(v.image) || !rewards) return null;
      return { ...common, amount: rewards.amount, summary: `그림 퀴즈: ${question}`, details: { question, answer, ...rewards.details } };
    }
    default:
      return null;
  }

  function timeOk(value: unknown) {
    return Number.isInteger(value) && (value as number) > 0 && (value as number) <= game.maxTimeSec;
  }

  /** The larger reward is held from the balance; settling the difference is TBD. */
  function quizRewards(q: Record<string, unknown>) {
    const { correctReward, wrongReward } = q;
    if (!isFn(correctReward) || !isFn(wrongReward) || Math.max(correctReward, wrongReward) < game.minAmount) return null;
    if (!timeOk(q.timeLimitSec) || q.termsAgreed !== true) return null;
    return { amount: Math.max(correctReward, wrongReward), details: { timeLimitSec: q.timeLimitSec, correctReward, wrongReward } };
  }
}
