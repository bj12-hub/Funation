"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { findAsset, matchesContent, mockAssets, publicAsset, sniffMime } from "./assetCore";
import { ASSET_LIMITS, ASSET_TYPES, assetUrl, type Asset, type AssetKind, type AssetResult } from "./assetTypes";

/**
 * 이미지·사운드 라이브러리 Server Actions — code-first. Route `/creator/widgets/assets`.
 * Creator only; type is checked from the file bytes, not the name. Uploads carry a `requestId`.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Asset API is not connected yet.");
};
const invalid = (message: string) => ({ status: "INVALID", message }) as const;
const nameOk = (name: string) => name.length >= 1 && name.length <= ASSET_LIMITS.nameMax && !MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w));

export async function listAssets(kind?: AssetKind): Promise<Asset[] | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return mockAssets.items.filter((a) => !kind || a.kind === kind).map(publicAsset);
}

export async function uploadAsset(formData: FormData): Promise<AssetResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const requestId = String(formData.get("requestId") ?? "");
  if (!/^[A-Za-z0-9-]{16,64}$/.test(requestId)) return invalid("잘못된 요청입니다.");
  const done = findAsset(mockAssets.requests[requestId]);
  if (done) return { status: "SAVED", asset: publicAsset(done) };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return invalid("파일을 선택해 주세요.");
  const kind: AssetKind | null = ASSET_TYPES.IMAGE.includes(file.type) ? "IMAGE" : ASSET_TYPES.SOUND.includes(file.type) ? "SOUND" : null;
  if (!kind) return invalid("PNG · JPG · GIF · WEBP 이미지나 MP3 · WAV · OGG 사운드만 올릴 수 있어요.");
  if (file.size > ASSET_LIMITS.bytes[kind]) return invalid(`${kind === "IMAGE" ? "이미지" : "사운드"}는 ${ASSET_LIMITS.bytes[kind] / 1024 / 1024}MB 이하만 올릴 수 있어요.`);
  if (mockAssets.items.length >= ASSET_LIMITS.max) return invalid(`라이브러리에는 ${ASSET_LIMITS.max}개까지 보관할 수 있어요.`);
  const used = mockAssets.items.reduce((sum, a) => sum + a.size, 0);
  if (used + file.size > ASSET_LIMITS.totalBytes) return invalid("라이브러리 용량이 부족해요. 쓰지 않는 파일을 지워 주세요.");

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!matchesContent(bytes, file.type)) return invalid("파일 내용이 형식과 맞지 않아요.");
  const sniffed = sniffMime(bytes)!;

  const rawName = String(formData.get("name") ?? "").trim() || file.name.replace(/\.[^.]+$/, "").trim();
  const name = rawName.slice(0, ASSET_LIMITS.nameMax);
  if (!nameOk(name)) return invalid("사용할 수 없는 이름이에요.");
  await mockDelay(300);
  const id = randomUUID();
  const asset = { id, kind, name, mime: sniffed, size: file.size, url: assetUrl(id), uploadedAt: new Date().toISOString(), bytes };
  mockAssets.items.unshift(asset);
  mockAssets.requests[requestId] = id;
  return { status: "SAVED", asset: publicAsset(asset) };
}

export async function renameAsset(input: unknown): Promise<AssetResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const asset = findAsset(v.id);
  if (!asset) return invalid("파일을 찾을 수 없어요.");
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!nameOk(name)) return invalid(`이름을 1~${ASSET_LIMITS.nameMax}자로 입력해 주세요.`);
  asset.name = name;
  return { status: "SAVED", asset: publicAsset(asset) };
}

/** Idempotent. Widgets that used the file skip it from then on (banner slides, signature images). */
export async function deleteAsset(id: unknown): Promise<AssetResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  mockAssets.items = mockAssets.items.filter((a) => a.id !== id);
  return { status: "DELETED" };
}
