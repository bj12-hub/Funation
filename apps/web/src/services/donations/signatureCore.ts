import { toCsv } from "@/lib/csv";
import { sameSecret } from "@/lib/secret";
import { zipFiles, type ZipEntry } from "@/lib/zip";
import { creatorAccessOpen } from "@/services/account/creatorAccess";
import { mockCreator, newIntegrationKey } from "@/services/creator/mockCreatorStore";
import { getMockDonationCatalog, rouletteOffer, type DonationCatalog, type Signature } from "./donationCatalog";
import { readWidget } from "@/services/creator/widgetStore";
import { gachaOffers } from "./gachaCore";
import { findAsset } from "@/services/creator/assetCore";
import { assetUrl } from "@/services/creator/assetTypes";
import { DEFAULT_SIGNATURE_GROUP, SIGNATURE_IMAGE_PRESETS, amountSpan, type ManagedSignature, type PublicSignaturePage } from "./signatureTypes";

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
  /** 공개 시그니처 페이지 (2026-10-25): on/off and the key in its address. */
  publicPage?: { enabled: boolean; key: string };
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

// ── 공개 시그니처 페이지 · 시그니처 ZIP (2026-10-25, StreamDonate 시그니처 관리 참고) ─────────────────────────

/** The page's on/off and key (off with a fresh key until the creator turns it on). */
export const signaturePage = () => (mockSignatures.publicPage ??= { enabled: false, key: newIntegrationKey() });
export const signaturePagePath = (key: string) => `/signatures/${key}`;

/**
 * What the public page shows for `key`, or null — page off, wrong key, or the creator's access closed (a refused key
 * looks like an unknown one). Active signatures only, in the creator's order, with the image and sound alerts use.
 */
export function publicSignaturePage(key: unknown): PublicSignaturePage | null {
  const page = signaturePage();
  if (!page.enabled || !creatorAccessOpen() || !sameSecret(key, page.key)) return null;
  const signatures = mockSignatures.items
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, price: s.price, imageUrl: signatureImageOf(s), soundUrl: signatureSoundOf(s) ?? null, group: s.group }));
  return { channelName: mockCreator.channelName, signatures, groups: [...new Set(signatures.map((s) => s.group))] };
}

const IMAGE_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
const SOUND_EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm" };
/** Characters a file name cannot hold become _. */
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || "시그니처";

/** A signature file's bytes and extension: a preset image from `public/`, or a library file. */
async function fileOf(url: string, exts: Record<string, string>): Promise<{ data: Uint8Array; ext: string } | null> {
  if (SIGNATURE_IMAGE_PRESETS.includes(url)) {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    // Only the known preset paths are read, so nothing outside public/mock can be asked for.
    return { data: new Uint8Array(await readFile(join(process.cwd(), "public", url))), ext: "png" };
  }
  const asset = url.startsWith("/api/media/") ? findAsset(url.slice("/api/media/".length)) : undefined;
  return asset ? { data: new Uint8Array(asset.bytes), ext: exts[asset.mime] ?? "bin" } : null;
}

/**
 * 시그니처 ZIP: every signature (hidden ones too) as `NN_이름_가격FN.ext` with its sound as `NN_이름_사운드.ext`, and
 * `시그니처 목록.csv` (lib/csv) listing them in the creator's order. Images and sounds as alerts use them.
 */
export async function signatureArchive(now = new Date()) {
  const files: ZipEntry[] = [];
  const rows: (string | number)[][] = [];
  for (const [i, s] of mockSignatures.items.entries()) {
    const stem = `${String(i + 1).padStart(2, "0")}_${fileSafe(s.name)}`;
    const image = await fileOf(signatureImageOf(s), IMAGE_EXT);
    const imageName = image ? `${stem}_${s.price}FN.${image.ext}` : "";
    if (image) files.push({ name: imageName, data: image.data });
    const soundUrl = signatureSoundOf(s);
    const sound = soundUrl ? await fileOf(soundUrl, SOUND_EXT) : null;
    const soundName = sound ? `${stem}_사운드.${sound.ext}` : "";
    if (sound) files.push({ name: soundName, data: sound.data });
    rows.push([i + 1, s.name, s.price, s.group, s.active ? "사용" : "숨김", s.match === "AMOUNT" ? "선택 + 금액 일치" : "선택 시에만", s.rangeMin ?? "", imageName, soundName]);
  }
  const csv = toCsv(["순서", "이름", "가격(FN)", "그룹", "사용", "매칭", "금액범위 시작", "이미지 파일", "사운드 파일"], rows);
  files.push({ name: "시그니처 목록.csv", data: new TextEncoder().encode(csv) });
  return { bytes: zipFiles(files, now), count: mockSignatures.items.length };
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
