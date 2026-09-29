"use server";

import { toDateString } from "@/lib/period";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { getCreatorById } from "@/services/creators/creators";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { getMockDonationCatalog, luckyTierFor, type DonationCatalog } from "./donationCatalog";
import { parseYouTubeId, type DonationResult } from "./donationTypes";

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

  const catalog = getMockDonationCatalog();
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
      category: "basic",
      status: "COMPLETED"
    });
    result = { status: "COMPLETED", donationId, fnAmount: request.amount, balance: mockAccount.fnBalance };
  }
  mockWallet.donationIdempotency[idempotencyKey].result = result;
  return result;
}

// ── Validation ───────────────────────────────────────────────────────────────

type Parsed = {
  idempotencyKey: string;
  creatorId: string;
  hideProfile: boolean;
  type: string;
  amount: number;
  /** Text recorded in the donation history. */
  summary: string;
  details: Record<string, unknown>;
};

const MAX_FN = 999_999_999;

function parse(input: unknown, catalog: DonationCatalog): Parsed | null {
  if (typeof input !== "object" || input === null) return null;
  const v = input as Record<string, unknown>;
  if (typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.idempotencyKey)) return null;
  if (typeof v.creatorId !== "string" || typeof v.hideProfile !== "boolean") return null;
  const typeInfo = catalog.types.find((t) => t.key === v.type);
  if (!typeInfo?.available) return null;

  const common = { idempotencyKey: v.idempotencyKey, creatorId: v.creatorId, hideProfile: v.hideProfile, type: typeInfo.key };
  const amountOk = (min: number) => typeof v.amount === "number" && Number.isInteger(v.amount) && v.amount >= min && v.amount <= MAX_FN;
  const text = (value: unknown, max: number, required = false) =>
    typeof value === "string" && value.trim().length <= max && (!required || value.trim().length > 0) ? value.trim() : null;
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
    default:
      return null;
  }
}
