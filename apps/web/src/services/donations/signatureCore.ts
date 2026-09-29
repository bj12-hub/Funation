import { getMockDonationCatalog, type DonationCatalog, type Signature } from "./donationCatalog";
import type { ManagedSignature } from "./signatureTypes";

/**
 * Server-only signature store (not a "use server" module). Seeded from the Figma catalog; the creator's
 * edits replace the catalog's signatures for every donation panel in the mock (per-channel catalogs TBD).
 */

type Store = { items: ManagedSignature[]; requests: Record<string, string>; favorites: Record<string, boolean> };
const g = globalThis as typeof globalThis & { __funationMockSignaturesV1?: Store };

export const mockSignatures = (g.__funationMockSignaturesV1 ??= ((): Store => {
  const seed = getMockDonationCatalog().signatures;
  return {
    items: seed.map((s): ManagedSignature => ({ id: s.id, name: s.name, price: s.price, imageUrl: s.imageUrl, match: "SELECT", active: true })),
    requests: {},
    favorites: Object.fromEntries(seed.map((s) => [s.id, s.favorite]))
  };
})());

/** Active signatures in the creator's order, shaped for the donation panel. */
export function activeSignatures(): Signature[] {
  return mockSignatures.items
    .filter((s) => s.active)
    .map((s, i) => ({ id: s.id, name: s.name, price: s.price, imageUrl: s.imageUrl, favorite: mockSignatures.favorites[s.id] ?? false, rank: i + 1 }));
}

/** The donation catalog with the managed signatures (used by the room and the Donation Core). */
export function getDonationCatalog(): DonationCatalog {
  return { ...getMockDonationCatalog(), signatures: activeSignatures() };
}

/** 금액 매칭: an active AMOUNT-match signature whose price equals the 일반 후원 amount, if any. */
export function matchSignatureByAmount(amount: number): ManagedSignature | null {
  return mockSignatures.items.find((s) => s.active && s.match === "AMOUNT" && s.price === amount) ?? null;
}
