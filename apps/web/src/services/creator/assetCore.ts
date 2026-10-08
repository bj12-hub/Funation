import type { Asset, AssetKind } from "./assetTypes";

/**
 * Server-only asset store (not a "use server" module). The mock keeps file bytes in memory; the real
 * backend stores files in object storage (and may scan them) and returns CDN URLs.
 */

type StoredAsset = Asset & { bytes: Buffer };
type MockAssets = { items: StoredAsset[]; requests: Record<string, string> };

const g = globalThis as typeof globalThis & { __ssumnationMockAssetsV1?: MockAssets };
export const mockAssets = (g.__ssumnationMockAssetsV1 ??= { items: [], requests: {} });

export const publicAsset = (a: StoredAsset): Asset => ({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, size: a.size, url: a.url, uploadedAt: a.uploadedAt });

export function findAsset(id: unknown, kind?: AssetKind) {
  const a = mockAssets.items.find((x) => x.id === id);
  return a && (!kind || a.kind === kind) ? a : null;
}

const WAV_ALIASES = ["audio/wav", "audio/x-wav"];

/** Whether the bytes really are the declared type (a renamed file cannot pass as an image or sound). */
export function matchesContent(bytes: Buffer, declared: string) {
  const sniffed = sniffMime(bytes);
  return sniffed === declared || (sniffed === "audio/wav" && WAV_ALIASES.includes(declared));
}

/** Checks the file's leading bytes so a renamed file cannot pass as another type. */
export function sniffMime(b: Buffer): string | null {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  const ascii = (i: number, s: string) => b.subarray(i, i + s.length).toString("latin1") === s;
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "RIFF") && ascii(8, "WAVE")) return "audio/wav";
  if (ascii(0, "OggS")) return "audio/ogg";
  if (ascii(0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  // 정산 서류 (PDF): only that upload allows the type, the others refuse it before sniffing.
  if (ascii(0, "%PDF-")) return "application/pdf";
  return null;
}
