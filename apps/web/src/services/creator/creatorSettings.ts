"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { MOCK_FORBIDDEN_WORDS, mockAccount } from "@/services/account/mockStore";
import {
  BROADCAST_CATEGORIES,
  CREATOR_LANGUAGES,
  MAIN_PLATFORMS,
  MAX_ANNIVERSARIES,
  MAX_CATEGORIES,
  MAX_PROFILE_IMAGES,
  SNS_KINDS,
  isHttpUrl,
  isValidChannelName,
  type CreatorSettings,
  type SaveResult
} from "./creatorSettingsTypes";
import { matchesContent } from "./assetCore";
import { mockCreator, newIntegrationKey } from "./mockCreatorStore";
import { isIsoDate, toDateString } from "@/lib/period";

/**
 * Creator account settings — Figma 315:405 · 315:2 (route `/creator/settings`) and 326:496 (프로필 수정).
 *
 * Server Actions: each re-checks the session and validates its input. The integration key is a secret:
 * reads return it masked, the full value is only returned for an explicit copy, and reissuing it
 * invalidates the old key immediately (design copy). TBD: creator role check, key storage/rotation policy.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Creator settings API is not connected yet.");
};

const mask = (key: string) => `****-****-****-${key.slice(-4)}`;

export async function getCreatorSettings(): Promise<CreatorSettings | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(300);
  const c = mockCreator;
  return {
    channelName: c.channelName,
    ssumnationId: mockAccount.ssumnationId,
    images: [c.images[0] ?? mockAccount.avatarUrl, c.images[1], c.images[2]],
    debutDate: c.debutDate,
    debutPublic: c.debutPublic,
    birthday: c.birthday,
    birthdayPublic: c.birthdayPublic,
    anniversaries: structuredClone(c.anniversaries),
    categories: [...c.categories],
    liveProfileVisible: c.liveProfileVisible,
    marketingConsent: mockAccount.marketingConsent,
    languages: [...c.languages],
    donateUrl: `https://ssumnation.com/donate/${c.handle}`,
    rtmpUrl: `rtmp://live.ssumnation.com/stream/${c.handle}`,
    // The guide design shows the donate URL as the widget URL; the real overlay URL is TBD.
    alertWidgetUrl: `https://ssumnation.com/donate/${c.handle}`,
    integrationKeyMasked: mask(c.integrationKey),
    mainPlatform: c.mainPlatform,
    sns: structuredClone(c.sns)
  };
}

// ── Ssumnation 설정 / 메인 방송 플랫폼 / SNS ─────────────────────────────────────

export async function setLiveProfileVisible(visible: unknown): Promise<SaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof visible !== "boolean") return { status: "INVALID" };
  await mockDelay(300);
  mockCreator.liveProfileVisible = visible;
  return { status: "SAVED" };
}

export async function setCreatorLanguages(languages: unknown): Promise<SaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const keys = CREATOR_LANGUAGES.map((l) => l.key) as string[];
  if (!Array.isArray(languages) || languages.length === 0 || !languages.every((l) => keys.includes(l))) {
    return { status: "INVALID", message: "언어를 1개 이상 선택해 주세요." };
  }
  await mockDelay(300);
  mockCreator.languages = [...new Set(languages)] as typeof mockCreator.languages;
  return { status: "SAVED" };
}

export async function setMainPlatform(platform: unknown): Promise<SaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!MAIN_PLATFORMS.some((p) => p.key === platform)) return { status: "INVALID" };
  await mockDelay(300);
  mockCreator.mainPlatform = platform as typeof mockCreator.mainPlatform;
  return { status: "SAVED" };
}

export async function saveSnsLinks(links: unknown): Promise<SaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (!Array.isArray(links) || links.length !== SNS_KINDS.length) return { status: "INVALID" };
  const parsed = links.map((l) => (typeof l === "object" && l !== null ? (l as { kind?: unknown; url?: unknown }) : {}));
  // Exactly one row per kind (the form has one field each), so four INSTAGRAM rows are refused.
  const kindsOk = SNS_KINDS.every((k) => parsed.filter((l) => l.kind === k.key).length === 1);
  const bad = parsed.find((l) => typeof l.url !== "string" || (l.url.trim() !== "" && !isHttpUrl(l.url)));
  if (!kindsOk) return { status: "INVALID" };
  if (bad) return { status: "INVALID", message: "http:// 또는 https://로 시작하는 주소를 입력해 주세요." };
  await mockDelay(400);
  mockCreator.sns = parsed.map((l) => ({ kind: l.kind as (typeof mockCreator.sns)[number]["kind"], url: (l.url as string).trim() }));
  return { status: "SAVED" };
}

// ── 연동키 ─────────────────────────────────────────────────────────────────────

/** Full key, only for the explicit 복사 action. */
export async function revealIntegrationKey(): Promise<{ status: "OK"; key: string } | { status: "UNAUTHORIZED" }> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  return { status: "OK", key: mockCreator.integrationKey };
}

/** Invalidates the previous key immediately (315:646 warning copy). */
export async function reissueIntegrationKey(): Promise<{ status: "REISSUED"; masked: string } | { status: "UNAUTHORIZED" }> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  await mockDelay(500);
  mockCreator.integrationKey = newIntegrationKey();
  // TODO: the backend must also revoke integrations that used the old key and audit the change.
  return { status: "REISSUED", masked: mask(mockCreator.integrationKey) };
}

// ── 프로필 수정 (326:496) ──────────────────────────────────────────────────────

export async function changeChannelName(name: unknown): Promise<SaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof name !== "string" || !isValidChannelName(name)) {
    return { status: "INVALID", message: "2~20자의 한글, 영문, 숫자, 공백, _만 사용할 수 있어요." };
  }
  if (MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  await mockDelay(400);
  mockCreator.channelName = name.trim();
  return { status: "SAVED" };
}

/** Earliest date accepted in the profile (a sanity bound, not a business rule). */
const DATE_MIN = "1900-01-01";

export async function saveCreatorProfile(input: unknown): Promise<SaveResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  if (typeof input !== "object" || input === null) return { status: "INVALID" };
  const v = input as Record<string, unknown>;
  if (!isIsoDate(v.birthday) || !isIsoDate(v.debutDate)) return { status: "INVALID", message: "날짜를 확인해 주세요." };
  // A real past day (validation bounds, not a business rule).
  if (v.debutDate > toDateString(new Date()) || v.debutDate < DATE_MIN) return { status: "INVALID", message: "방송 데뷔일은 오늘이나 그 이전 날짜로 입력해 주세요." };
  if (typeof v.birthdayPublic !== "boolean" || typeof v.debutPublic !== "boolean") return { status: "INVALID" };
  const anniversaries = Array.isArray(v.anniversaries) ? v.anniversaries : null;
  if (
    !anniversaries ||
    anniversaries.length > MAX_ANNIVERSARIES ||
    !anniversaries.every((a) => {
      const x = a as { name?: unknown; date?: unknown };
      return typeof x.name === "string" && x.name.trim().length >= 1 && x.name.trim().length <= 20 && isIsoDate(x.date);
    })
  ) {
    return { status: "INVALID", message: "기념일 이름과 날짜를 모두 입력해 주세요." };
  }
  const categories = Array.isArray(v.categories) ? v.categories : null;
  if (
    !categories ||
    categories.length > MAX_CATEGORIES ||
    new Set(categories).size !== categories.length ||
    !categories.every((c) => (BROADCAST_CATEGORIES as readonly unknown[]).includes(c))
  ) {
    return { status: "INVALID", message: `방송 정보는 최대 ${MAX_CATEGORIES}개까지 선택할 수 있어요.` };
  }
  await mockDelay(500);
  Object.assign(mockCreator, {
    birthday: v.birthday,
    birthdayPublic: v.birthdayPublic,
    debutDate: v.debutDate,
    debutPublic: v.debutPublic,
    anniversaries: anniversaries.map((a) => ({ name: (a as { name: string }).name.trim(), date: (a as { date: string }).date })),
    categories
  });
  return { status: "SAVED" };
}

export type ImageUploadResult = { status: "UPLOADED"; url: string } | { status: "UNSUPPORTED" | "TOO_LARGE" | "FAILED" | "UNAUTHORIZED" };

/** Uploads one of the three profile images (slot 0 is 대표). Same file rules as my page (745:52 · 745:98). */
export async function uploadCreatorImage(formData: FormData): Promise<ImageUploadResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const slot = Number(formData.get("slot"));
  const file = formData.get("image");
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_PROFILE_IMAGES || !(file instanceof File)) return { status: "FAILED" };
  if (!(PROFILE_PHOTO_TYPES as readonly string[]).includes(file.type)) return { status: "UNSUPPORTED" };
  if (file.size > PROFILE_PHOTO_MAX_BYTES) return { status: "TOO_LARGE" };
  await mockDelay(600);
  const bytes = Buffer.from(await file.arrayBuffer());
  // The bytes must really be the declared type: a renamed file cannot pass as an image.
  if (!matchesContent(bytes, file.type)) return { status: "UNSUPPORTED" };
  // Mock storage: data URL in memory. The real backend stores the file and returns a URL.
  const url = `data:${file.type};base64,${bytes.toString("base64")}`;
  mockCreator.images[slot] = url;
  return { status: "UPLOADED", url };
}
