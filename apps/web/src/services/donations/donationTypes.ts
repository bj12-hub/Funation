import type { DonationType } from "@/services/creators/creatorRoom";

/**
 * Donation request / result types. Client-safe; the action lives in ./donate.ts.
 * Figma: 610:138 (form) · 613:6 (확인) · 613:122 (완료) · 613:237 (FN 부족)
 */

export type DonationRequest = {
  creatorId: string;
  type: DonationType["key"];
  amount: number;
  message: string;
  voiceId: string | null;
  hideProfile: boolean;
  /** Generated once per confirmed submission; the same key never debits twice. */
  idempotencyKey: string;
};

export type DonationResult =
  | {
      status: "COMPLETED";
      donationId: string;
      fnAmount: number;
      /** Balance after the debit, from the server. */
      balance: number;
    }
  | { status: "INSUFFICIENT_FN"; balance: number }
  | { status: "IN_PROGRESS" | "CONFLICT" | "INVALID" | "NOT_FOUND" | "UNAUTHORIZED" };

export const MAX_DONATION_MESSAGE = 100;
