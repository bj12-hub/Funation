"use server";

import { toDateString } from "@/lib/period";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { DONATION } from "@/services/creators/creatorRoom";
import { getCreatorById } from "@/services/creators/creators";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { MAX_DONATION_MESSAGE, type DonationResult } from "./donationTypes";

/**
 * Donation Core: one debit path for every donation type (CLAUDE.md §10). Type-specific behavior
 * (video URL, wishlist item, lucky box draw, …) is TBD and not modelled yet.
 *
 * Server Action: re-checks the session, validates input, checks the balance on the server and is
 * idempotent per `idempotencyKey` — a retried or double-submitted request returns the first result.
 * TBD: creator revenue share, platform fee, refunds, delivery to the broadcast platform.
 */
export async function requestDonation(input: unknown): Promise<DonationResult> {
  if (!USE_MOCK) throw new Error("Donation API is not connected yet.");
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };

  const parsed = parse(input);
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
    result = { status: "INSUFFICIENT_FN", balance: mockAccount.fnBalance };
  } else {
    // Debit and record in one step (the backend must do this in a single transaction).
    mockAccount.fnBalance -= request.amount;
    const now = new Date();
    const donationId = `dn-${now.getTime()}`;
    const type = DONATION.types.find((t) => t.key === request.type)!;
    mockWallet.donations.unshift({
      id: donationId,
      donatedAt: `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`,
      creatorId: creator.id,
      creatorName: creator.name,
      message: request.message,
      fnAmount: request.amount,
      typeLabel: type.title,
      category: "basic",
      status: "COMPLETED"
    });
    result = { status: "COMPLETED", donationId, fnAmount: request.amount, balance: mockAccount.fnBalance };
  }
  mockWallet.donationIdempotency[idempotencyKey].result = result;
  return result;
}

function parse(input: unknown) {
  if (typeof input !== "object" || input === null) return null;
  const v = input as Record<string, unknown>;
  if (typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.idempotencyKey)) return null;
  if (typeof v.creatorId !== "string") return null;
  if (typeof v.type !== "string" || !DONATION.types.some((t) => t.key === v.type)) return null;
  if (typeof v.amount !== "number" || !Number.isInteger(v.amount) || v.amount < DONATION.minAmount || v.amount > 999_999_999) return null;
  if (typeof v.message !== "string" || v.message.length > MAX_DONATION_MESSAGE) return null;
  if (v.voiceId !== null && (typeof v.voiceId !== "string" || !DONATION.voices.some((voice) => voice.id === v.voiceId))) return null;
  if (typeof v.hideProfile !== "boolean") return null;
  return {
    idempotencyKey: v.idempotencyKey,
    creatorId: v.creatorId,
    type: v.type,
    amount: v.amount,
    message: v.message.trim(),
    voiceId: v.voiceId as string | null,
    hideProfile: v.hideProfile
  };
}
