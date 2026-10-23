import { getMockDonationCatalog, rouletteOffer, type DonationCatalog, type Signature } from "./donationCatalog";
import { readWidget } from "@/services/creator/widgetStore";
import { gachaOffers } from "./gachaCore";
import { findAsset } from "@/services/creator/assetCore";
import { assetUrl } from "@/services/creator/assetTypes";
import { DEFAULT_SIGNATURE_GROUP, SIGNATURE_IMAGE_PRESETS, amountSpan, type ManagedSignature } from "./signatureTypes";

/**
 * Server-only signature store (not a "use server" module). Seeded from the Figma catalog; the creator's
 * edits replace the catalog's signatures for every donation panel in the mock (per-channel catalogs TBD).
 */

type Store = {
  items: ManagedSignature[];
  requests: Record<string, string>;
  /** 일괄 만들기 requestId → the ids it created (added 2026-10-06; older dev stores start without it). */
  bulk?: Record<string, string[]>;
  favorites: Record<string, boolean>;
};
const g = globalThis as typeof globalThis & { __ssumnationMockSignaturesV1?: Store };

export const mockSignatures = (g.__ssumnationMockSignaturesV1 ??= ((): Store => {
  const seed = getMockDonationCatalog().signatures;
  return {
    items: seed.map((s): ManagedSignature => ({ id: s.id, name: s.name, price: s.price, imageUrl: s.imageUrl, soundUrl: null, match: "SELECT", active: true, rangeMin: null, group: DEFAULT_SIGNATURE_GROUP })),
    requests: {},
    favorites: Object.fromEntries(seed.map((s) => [s.id, s.favorite]))
  };
})());

// 금액범위 · 그룹 (2026-10-23): signatures saved before have neither.
for (const s of mockSignatures.items) {
  s.rangeMin ??= null;
  s.group ??= DEFAULT_SIGNATURE_GROUP;
}

/** A preset image or an IMAGE in the creator's library. */
export function isSignatureImage(url: string) {
  if (SIGNATURE_IMAGE_PRESETS.includes(url)) return true;
  const id = url.startsWith("/api/media/") ? url.slice("/api/media/".length) : null;
  return !!id && !!findAsset(id, "IMAGE") && assetUrl(id) === url;
}

/** A SOUND in the creator's library (a deleted file no longer counts, so its signature plays nothing). */
export function isSignatureSound(url: string) {
  const id = url.startsWith("/api/media/") ? url.slice("/api/media/".length) : null;
  return !!id && !!findAsset(id, "SOUND") && assetUrl(id) === url;
}

/** A signature's image as alerts show it: a library image deleted since falls back to the first preset. */
export const signatureImageOf = (s: ManagedSignature) => (isSignatureImage(s.imageUrl) ? s.imageUrl : SIGNATURE_IMAGE_PRESETS[0]);
/** A signature's sound, while it is still in the library. */
export const signatureSoundOf = (s: ManagedSignature) => (s.soundUrl && isSignatureSound(s.soundUrl) ? s.soundUrl : undefined);

/** Active signatures in the creator's order, shaped for the donation panel. */
export function activeSignatures(): Signature[] {
  return mockSignatures.items
    .filter((s) => s.active)
    .map((s, i) => ({ id: s.id, name: s.name, price: s.price, imageUrl: isSignatureImage(s.imageUrl) ? s.imageUrl : SIGNATURE_IMAGE_PRESETS[0], favorite: mockSignatures.favorites[s.id] ?? false, rank: i + 1 }));
}

/** The donation catalog with the managed signatures and the 룰렛 · 뽑기 settings (used by the room and the Donation Core). */
export function getDonationCatalog(): DonationCatalog {
  return { ...getMockDonationCatalog(), signatures: activeSignatures(), roulette: rouletteOffer(readWidget("ROULETTE")), gacha: gachaOffers() };
}

/**
 * 금액 매칭: the active AMOUNT-match signature whose price — or 금액범위 (2026-10-23) — takes the 일반 후원 amount, if any.
 * The save checks keep those amounts apart, so at most one signature takes an amount.
 */
export function matchSignatureByAmount(amount: number): ManagedSignature | null {
  return (
    mockSignatures.items.find((s) => {
      if (!s.active || s.match !== "AMOUNT") return false;
      const { from, to } = amountSpan(s);
      return amount >= from && amount <= to;
    }) ?? null
  );
}

/** The signature a donation alerts as (시그 카운트, 2026-10-23): the chosen one, or the one a 일반 후원 matched by amount. */
export function signatureIdFor(type: string, amount: number, details: unknown): string | undefined {
  if (type === "SIGNATURE") return (details as { signatureId?: string } | null)?.signatureId;
  return type === "TEXT" ? matchSignatureByAmount(amount)?.id : undefined;
}

/** The signature's library sound for a 시그니처 후원 (or an amount-matched 일반 후원); the alert overlay plays it. */
export function signatureSoundFor(type: string, amount: number, details: unknown): string | undefined {
  const id = (details as { signatureId?: string } | null)?.signatureId;
  const sig = type === "SIGNATURE" ? mockSignatures.items.find((s) => s.active && s.id === id) : type === "TEXT" ? matchSignatureByAmount(amount) : null;
  return sig?.soundUrl && isSignatureSound(sig.soundUrl) ? sig.soundUrl : undefined;
}

/**
 * The signature image a donation carries to the alert feed (벽지 "후원 이미지 우선", 2026-10-05 결정): the chosen
 * signature of a 시그니처 후원, or the amount-matched signature of a 일반 후원. Other donations have none. An image
 * deleted from the library falls back to the first preset on both paths, as the donation panel shows it.
 */
export function signatureImageFor(catalog: DonationCatalog, type: string, amount: number, details: unknown): string | undefined {
  if (type === "SIGNATURE") return catalog.signatures.find((s) => s.id === (details as { signatureId?: string } | null)?.signatureId)?.imageUrl;
  if (type !== "TEXT") return undefined;
  const sig = matchSignatureByAmount(amount);
  return sig ? (isSignatureImage(sig.imageUrl) ? sig.imageUrl : SIGNATURE_IMAGE_PRESETS[0]) : undefined;
}
