/**
 * Donation request / result types. Client-safe; the action lives in ./donate.ts.
 * Figma: 610:138 · 851:* (forms) · 613:6 (확인) · 613:122 (완료) · 613:237 (FN 부족)
 *
 * One Donation Core handles every type; only the details differ (CLAUDE.md §10).
 * Signature, wishlist and 뽑기 prices are looked up on the server — the browser never sets them. It sends the price the
 * supporter confirmed (`expectedAmount`); if the creator changed it meanwhile, nothing is debited (PRICE_CHANGED).
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
      termsAgreed: boolean;
    }
  | { type: "SIGNATURE"; signatureId: string; message: string; expectedAmount: number }
  | { type: "WISHLIST"; itemId: string; message: string; voiceId: string | null; expectedAmount: number }
  /** One spin per participation; the amount must reach the creator's 최소 참여 금액 (server settings). */
  | { type: "ROULETTE"; amount: number }
  | {
      type: "QUEST";
      title: string;
      successReward: number;
      timeLimitSec: number;
      creatorDecides: boolean;
      termsAgreed: boolean;
    }
  | { type: "DRAWING"; amount: number; title: string; image: string; showProcess: boolean; canvasMode: boolean; termsAgreed: boolean }
  /** The price comes from the creator's 뽑기 settings; the prize is drawn by the server. */
  | { type: "GACHA"; gachaId: string; termsAgreed: boolean; expectedAmount: number };

/** Max size of a drawing sent as a PNG data URL (TBD with the overlay/storage design). */
export const MAX_DRAWING_CHARS = 400_000;

export type DonationRequest = DonationDetails & {
  creatorId: string;
  hideProfile: boolean;
  /** Donation nickname (별명) id; omitted or null = the default nickname. Must belong to the supporter. */
  nicknameId?: string | null;
  /** Crew member the donation is for (크루 멤버 지정); must be an active member of the creator's crew. */
  memberId?: string | null;
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
  /** The creator changed the signature / wishlist / 뽑기 price after the supporter saw it; `amount` is the price now. */
  | { status: "PRICE_CHANGED"; amount: number }
  /** `message` when the text itself was refused (a forbidden word); without it the request was malformed. */
  | { status: "INVALID"; message?: string }
  | { status: "IN_PROGRESS" | "CONFLICT" | "NOT_FOUND" | "UNAUTHORIZED" };

/** Accepts youtube.com/watch?v=… and youtu.be/… (other hosts are TBD). Returns the video id or null. */
export function parseYouTubeId(url: string): string | null {
  const m = url.trim().match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{6,20})(?:[&?#].*)?$/i);
  return m ? m[1] : null;
}
