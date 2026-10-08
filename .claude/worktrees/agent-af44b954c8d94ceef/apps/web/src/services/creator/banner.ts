"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { sameSecret } from "@/lib/secret";
import { overlaySignal } from "./alertCore";
import { findAsset } from "./assetCore";
import { BANNER_LIMITS, type BannerResult, type BannerSettings, type OverlayBanner } from "./bannerTypes";
import { mockCreator } from "./mockCreatorStore";

/**
 * 배너 위젯 Server Actions — code-first. Route `/creator/widgets/banner`, overlay `/overlay/banner/[key]`.
 * Slides must be library images; a slide whose file was deleted is skipped.
 */

const g = globalThis as typeof globalThis & { __funationMockBannerV1?: BannerSettings };
const store = () => (g.__funationMockBannerV1 ??= { enabled: false, position: "BOTTOM", intervalSec: 8, slides: [] });

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Banner API is not connected yet.");
};
const liveSlides = (ids: string[]) => ids.flatMap((id) => (findAsset(id, "IMAGE") ? [id] : []));

export async function getBannerSettings(): Promise<BannerSettings | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const s = store();
  return { ...s, slides: liveSlides(s.slides) };
}

export async function saveBannerSettings(input: unknown): Promise<BannerResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.enabled !== "boolean") return { status: "INVALID", message: "사용 여부를 확인해 주세요." };
  if (v.position !== "TOP" && v.position !== "CENTER" && v.position !== "BOTTOM") return { status: "INVALID", message: "위치를 골라 주세요." };
  const iv = v.intervalSec;
  if (!Number.isInteger(iv) || (iv as number) < BANNER_LIMITS.intervalMin || (iv as number) > BANNER_LIMITS.intervalMax) {
    return { status: "INVALID", message: `넘김 간격은 ${BANNER_LIMITS.intervalMin}~${BANNER_LIMITS.intervalMax}초예요.` };
  }
  const slides = Array.isArray(v.slides) ? v.slides : null;
  if (!slides || slides.length > BANNER_LIMITS.slidesMax || new Set(slides).size !== slides.length) return { status: "INVALID", message: `슬라이드는 ${BANNER_LIMITS.slidesMax}장까지, 중복 없이 골라 주세요.` };
  if (!slides.every((id) => findAsset(id, "IMAGE"))) return { status: "INVALID", message: "라이브러리에 없는 이미지가 있어요." };
  if (v.enabled && slides.length === 0) return { status: "INVALID", message: "배너를 켜려면 이미지를 1장 이상 골라 주세요." };
  g.__funationMockBannerV1 = { enabled: v.enabled, position: v.position, intervalSec: iv as number, slides: slides as string[] };
  return { status: "SAVED" };
}

/** OBS overlay read — no login; the integration key is the secret. */
export async function getOverlayBanner(key: unknown): Promise<OverlayBanner | "FORBIDDEN"> {
  assertMock();
  if (!sameSecret(key, mockCreator.integrationKey)) return "FORBIDDEN";
  const s = store();
  const slides = liveSlides(s.slides).map((id) => ({ id, url: findAsset(id)!.url }));
  return { enabled: s.enabled && slides.length > 0, position: s.position, intervalSec: s.intervalSec, slides, ...overlaySignal("banner") };
}
