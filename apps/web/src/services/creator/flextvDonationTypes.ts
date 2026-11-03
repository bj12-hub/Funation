"use server";

import { FlextvUnavailableError } from "@/lib/flextv/client";
import { FLEXTV_SSUMNATION_API } from "@/lib/flextv/mode";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { fetchMySettings, saveMySettings } from "@/lib/flextv/ssumnation";
import { parseTypeSettings, type DonationTypeSettings, type SaveTypeSettingsResult } from "./donationTypeSettings";
import { studioContext } from "./flextvStudio";

/**
 * 후원 종류 설정 with FLEXTV (phase 6): the streamer's 미니 · 위시리스트 · 그림 · 룰렛 · 뽑기, kept by FLEXTV for the
 * streamer's own channel (docs/development/flextv-ssumnation-api.md §5). Only with FLEXTV_SSUMNATION_API. A save is
 * checked here first (./donationTypeSettings.ts) and FLEXTV checks it again; one save at a time per streamer.
 */

const serialize = createQueue("donationTypes");

export async function getDonationTypeSettings(): Promise<DonationTypeSettings | null> {
  if (!FLEXTV_SSUMNATION_API) return null;
  const ctx = await studioContext();
  return ctx ? fetchMySettings(ctx.token) : null;
}

export async function saveDonationTypeSettings(input: unknown): Promise<SaveTypeSettingsResult> {
  if (!FLEXTV_SSUMNATION_API) return { status: "UNKNOWN" };
  const ctx = await studioContext();
  if (!ctx) return { status: "UNAUTHORIZED" };
  const parsed = parseTypeSettings(input);
  if ("invalid" in parsed) return { status: "INVALID", message: parsed.invalid };
  const context = await requestDeviceContext();
  return serialize(ctx.session.userId, async () => {
    try {
      const outcome = await saveMySettings(ctx.token, context, parsed);
      if (outcome.kind === "SAVED") return { status: "SAVED", settings: outcome.settings };
      if (outcome.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
      return { status: "INVALID", message: outcome.message ?? "FLEXTV가 설정을 받지 않았어요. 값을 확인해 주세요." };
    } catch (error) {
      if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
      throw error;
    }
  });
}
