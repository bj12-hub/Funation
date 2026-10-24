"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { mockBannerProvider, parseBannerRequest } from "./aiBannerCore";
import type { AiBannerResult } from "./aiBannerTypes";

/**
 * AI 배너 Server Actions — code-first (no Figma frame; StreamDonate "배너 제작" 참고, P3). Route
 * `/creator/widgets/banner/ai` (creator session). The provider is the mock until a real AI image service is chosen (TBD);
 * saving goes through the 이미지·사운드 library (`uploadAsset`) like any image.
 */

export async function generateBanners(input: unknown): Promise<AiBannerResult> {
  if (!USE_MOCK) throw new Error("AI banner API is not connected yet.");
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const req = parseBannerRequest(input, MOCK_FORBIDDEN_WORDS);
  if ("message" in req) return { status: "INVALID", message: req.message };
  return { status: "OK", provider: "MOCK", images: await mockBannerProvider.generate(req) };
}
