/**
 * 시그니처 후원 관리 — code-first (funnation 위젯 "시그니처 후원: 시그니처를 만들고 매칭 규칙을 정합니다").
 * Prices and matching are channel settings chosen by the creator. Client-safe types and limits.
 */

/** "SELECT" = only when the supporter picks it; "AMOUNT" = also when a 일반 후원 amount equals the price. */
export type SignatureMatch = "SELECT" | "AMOUNT";

export type ManagedSignature = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  match: SignatureMatch;
  active: boolean;
};

export const SIGNATURE_LIMITS = { max: 50, nameMax: 20, priceMin: 100, priceMax: 10_000_000 } as const;

/** Preset images until the 이미지·사운드 library exists. */
export const SIGNATURE_IMAGE_PRESETS = Array.from({ length: 8 }, (_, i) => `/mock/room/signatures/sig-${i + 1}.png`);

export type SignatureResult = { status: "SAVED"; id: string } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
