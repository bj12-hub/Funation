"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { findAsset } from "./assetCore";
import { QR_SAMPLE_IMAGE, WIDGET_OVERLAYS, WIDGET_OVERLAY_SETTINGS, widgetOverlayPath } from "./widgetOverlayTypes";
import { readWidget, widgetStore } from "./widgetStore";
import { mockCreator } from "./mockCreatorStore";
import { PARSERS } from "./widgetParsers";
import {
  CUSTOM_SOUND_MAX,
  CUSTOM_SOUND_MAX_BYTES,
  CUSTOM_SOUND_TYPES,
  CUSTOM_SOUND_WORD_MAX,
  WALLPAPER_IMAGES_MAX,
  WIDGET_PATHS,
  isEditableWidget,
  type CustomSound,
  type CustomSoundResult,
  type WidgetDetail,
  type WidgetSaveResult,
  type WallpaperImageResult,
  type WidgetSettingsMap
} from "./widgetSettingsTypes";

/**
 * Widget settings — Figma 529:4 + popups 531:* (route `/creator/widgets`).
 * Server Actions re-check the session and fully validate each payload (see ./widgetParsers.ts).
 * TBD: creator role check, widget URL format/secret rotation, audit of setting changes, audio storage.
 */

const store = widgetStore;

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Widget settings API is not connected yet.");
};

const overlayPathFor = (key: string) => {
  const widget = WIDGET_OVERLAYS.find((w) => WIDGET_OVERLAY_SETTINGS[w] === key);
  return widget ? widgetOverlayPath(widget, mockCreator.integrationKey) : null;
};

export async function getWidgetDetail(key: unknown): Promise<WidgetDetail | null> {
  assertMock();
  if (!(await getCreatorSession()) || !isEditableWidget(key)) return null;
  await mockDelay(300);
  return {
    key,
    url: `https://somnation.com/widget/${WIDGET_PATHS[key]}/${mockCreator.handle}`,
    // 후원 위젯 with an OBS overlay show its real address (the popup adds the site origin and masks the key).
    overlayPath: overlayPathFor(key),
    settings: key === "GACHA" ? withLiveSounds(store.GACHA) : readWidget(key),
    live: {
      goalCurrent: 100_000,
      totalAmount: 250_000,
      qrImageUrl: QR_SAMPLE_IMAGE,
      ranking: [
        { name: "하니마루", amount: 200_000 },
        { name: "오라", amount: 100_000 },
        { name: "글레시아", amount: 50_000 },
        { name: "히레", amount: 25_000 },
        { name: "유니프론티어", amount: 10_000 },
        { name: "별빛팬", amount: 8_000 },
        { name: "코코넛", amount: 5_000 },
        { name: "달빛소나타", amount: 3_000 },
        { name: "치즈냥", amount: 2_000 },
        { name: "노을", amount: 1_000 }
      ],
      miniMinAmount: 100,
      gachaBoardUrl: `https://somnation.com/widget/gacha-win/${mockCreator.handle}`,
      gachaWins: [
        { gacha: "뽑기 후원", prize: "문화상품권 5천원", claimed: false },
        { gacha: "뽑기 후원", prize: "꽝 (다음 기회에)", claimed: null }
      ],
      gachaUnclaimed: 55
    }
  } as WidgetDetail;
}

/** A 당첨 효과음 deleted from the library reads as "none", like the 배너's deleted slides. */
function withLiveSounds(s: WidgetSettingsMap["GACHA"]): WidgetSettingsMap["GACHA"] {
  const copy = structuredClone(s);
  for (const g of copy.gachas) g.winSoundId = g.winSoundId && findAsset(g.winSoundId, "SOUND") ? g.winSoundId : null;
  return copy;
}

export async function saveWidgetSettings(key: unknown, input: unknown): Promise<WidgetSaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!isEditableWidget(key) || key === "CUSTOM_SOUND") return { status: "INVALID", message: "알 수 없는 위젯입니다." };
  const parsed = PARSERS[key](typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {});
  if (typeof parsed === "string") return { status: "INVALID", message: parsed };
  if (key === "GACHA" && (parsed as WidgetSettingsMap["GACHA"]).gachas.some((g) => g.winSoundId && !findAsset(g.winSoundId, "SOUND"))) {
    return { status: "INVALID", message: "라이브러리에 없는 효과음이 있어요. 다시 선택해 주세요." };
  }
  await mockDelay(400);
  // Wallpaper images are uploaded/deleted on their own; keep the stored list.
  (store as Record<string, unknown>)[key] = key === "WALLPAPER" ? { ...parsed, images: store.WALLPAPER.images } : parsed;
  return { status: "SAVED" };
}

// ── 커스텀 사운드 (373:1307) ───────────────────────────────────────────────────

/**
 * Adds or updates one sound. FormData: `id` (empty for new), `word`, `volume`, and either `file` or
 * `assetId` (a SOUND from the 이미지·사운드 library). A new sound needs one of them; an update without
 * either keeps the existing audio. A library sound is copied, so deleting it from the library later
 * does not break this sound.
 */
export async function saveCustomSound(formData: FormData): Promise<CustomSoundResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const id = String(formData.get("id") ?? "");
  const word = String(formData.get("word") ?? "").trim();
  const volume = Number(formData.get("volume"));
  const file = formData.get("file");
  const assetId = String(formData.get("assetId") ?? "");
  const sounds = store.CUSTOM_SOUND.sounds;
  const existing = id ? sounds.find((s) => s.id === id) : undefined;

  if (id && !existing) return { status: "INVALID", message: "삭제되었거나 없는 사운드입니다." };
  if (!existing && sounds.length >= CUSTOM_SOUND_MAX) return { status: "INVALID", message: `커스텀 사운드는 최대 ${CUSTOM_SOUND_MAX}개까지 등록할 수 있어요.` };
  if (word.length < 1 || word.length > CUSTOM_SOUND_WORD_MAX) return { status: "INVALID", message: `교체할 단어는 1~${CUSTOM_SOUND_WORD_MAX}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => word.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (sounds.some((s) => s.id !== id && s.word === word)) return { status: "INVALID", message: "이미 등록된 단어입니다." };
  if (!Number.isInteger(volume) || volume < 0 || volume > 100) return { status: "INVALID", message: "볼륨을 확인해 주세요." };

  const hasFile = file instanceof File && file.size > 0;
  if (!existing && !hasFile && !assetId) return { status: "INVALID", message: "효과음 파일을 선택해 주세요." };
  let audio: { fileName: string; fileUrl: string } | null = null;
  if (!hasFile && assetId) {
    const asset = findAsset(assetId, "SOUND");
    if (!asset) return { status: "INVALID", message: "라이브러리에 없는 사운드예요. 다시 선택해 주세요." };
    if (!(CUSTOM_SOUND_TYPES as readonly string[]).includes(asset.mime)) return { status: "INVALID", message: "MP3, WAV, OGG 파일만 등록할 수 있어요." };
    if (asset.size > CUSTOM_SOUND_MAX_BYTES) return { status: "INVALID", message: "파일은 2MB 이하만 등록할 수 있어요." };
    audio = { fileName: asset.name, fileUrl: `data:${asset.mime};base64,${asset.bytes.toString("base64")}` };
  }
  if (hasFile) {
    if (!(CUSTOM_SOUND_TYPES as readonly string[]).includes(file.type)) return { status: "INVALID", message: "MP3, WAV, OGG 파일만 등록할 수 있어요." };
    if (file.size > CUSTOM_SOUND_MAX_BYTES) return { status: "INVALID", message: "파일은 2MB 이하만 등록할 수 있어요." };
    // Mock storage: data URL in memory. The real backend stores the file (and may scan it) and returns a URL.
    audio = { fileName: file.name.slice(0, 80), fileUrl: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` };
  }
  await mockDelay(400);

  const sound: CustomSound = existing
    ? { ...existing, word, volume, ...(audio ?? {}) }
    : { id: randomUUID(), word, volume, fileName: audio!.fileName, fileUrl: audio!.fileUrl };
  store.CUSTOM_SOUND.sounds = existing ? sounds.map((s) => (s.id === id ? sound : s)) : [...sounds, sound];
  return { status: "SAVED", sound };
}

export async function deleteCustomSound(id: unknown): Promise<{ status: "DELETED" } | { status: "UNAUTHORIZED" }> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(300);
  // Idempotent: deleting a sound that is already gone is not an error.
  store.CUSTOM_SOUND.sounds = store.CUSTOM_SOUND.sounds.filter((s) => s.id !== id);
  return { status: "DELETED" };
}

// ── 벽지 이미지 (395:145) ───────────────────────────────────────────────────────

/** Same file rules as profile photos (JPG/PNG/WEBP, 5MB). The real limits for wallpaper images are TBD. */
export async function uploadWallpaperImage(formData: FormData): Promise<WallpaperImageResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { status: "FAILED" };
  if (store.WALLPAPER.images.length >= WALLPAPER_IMAGES_MAX) return { status: "LIMIT" };
  if (!(PROFILE_PHOTO_TYPES as readonly string[]).includes(file.type)) return { status: "UNSUPPORTED" };
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return { status: "TOO_LARGE" };
  await mockDelay(500);
  // Mock storage: data URL in memory.
  const image = { id: randomUUID(), url: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}` };
  store.WALLPAPER.images = [...store.WALLPAPER.images, image];
  return { status: "UPLOADED", image };
}

export async function deleteWallpaperImage(id: unknown): Promise<{ status: "DELETED" } | { status: "UNAUTHORIZED" }> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(300);
  store.WALLPAPER.images = store.WALLPAPER.images.filter((i) => i.id !== id);
  return { status: "DELETED" };
}
