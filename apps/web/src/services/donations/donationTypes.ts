/**
 * Donation request / result types. Client-safe; the action lives in ./donate.ts.
 * Figma: 610:138 · 851:* (forms) · 613:6 (확인) · 613:122 (완료) · 613:237 (FN 부족)
 *
 * One Donation Core handles every type; only the details differ (CLAUDE.md §10).
 * Signature and wishlist prices are looked up on the server — the browser never sends an amount for them.
 */

export type DonationDetails =
  | { type: "TEXT"; amount: number; message: string; voiceId: string | null }
  | { type: "MINI"; amount: number; text: string; colorId: string }
  | {
      type: "VIDEO";
      amount: number;
      videoUrl: string;
      startSec: number;
      endSec: number;
      saveToLibrary: boolean;
      termsAgreed: boolean;
    }
  | { type: "SIGNATURE"; signatureId: string; message: string }
  | { type: "WISHLIST"; itemId: string; message: string; voiceId: string | null }
  /** The draw itself happens on the server after the debit (TBD). */
  | { type: "LUCKYBOX"; amount: number; boxCount: number; winnerCount: number; termsAgreed: boolean };

export type DonationRequest = DonationDetails & {
  creatorId: string;
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
  | { status: "INSUFFICIENT_FN"; balance: number; required: number }
  | { status: "IN_PROGRESS" | "CONFLICT" | "INVALID" | "NOT_FOUND" | "UNAUTHORIZED" };

/** Accepts youtube.com/watch?v=… and youtu.be/… (other hosts are TBD). Returns the video id or null. */
export function parseYouTubeId(url: string): string | null {
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,20})(?:[&?#].*)?$/i);
  return m ? m[1] : null;
}
