"use server";

import { FlextvUnavailableError } from "@/lib/flextv/client";
import { FLEXTV_STUDIO } from "@/lib/flextv/mode";
import { createQueue } from "@/lib/flextv/queue";
import { requestDeviceContext } from "@/lib/flextv/request";
import { fetchMemberProfile, readStreamerStatus, registerStreamer } from "@/lib/flextv/studio";
import { forgetFlextvSession, getFlextvAccessToken, getSession, hasRole } from "@/lib/session";
import type { BecomeStreamerResult, StreamerGate } from "./streamerTypes";

/**
 * 내 채널 만들기 with FLEXTV (phase 5): a FLEXTV member becomes a streamer the way FLEXTV's 방송하기 does it — after
 * 본인인증, from 만 14세, foreign members through FLEXTV's 1:1 문의. FLEXTV then makes the member's stream key and
 * 본사 소속 (memberDiv 2), which is Ssumnation's Creator role (lib/flextv/auth.ts `sessionFromMember`).
 *
 * One registration runs at a time per member, and the result is read back from FLEXTV's profile.
 */

const serialize = createQueue("streamer");

/** Null when signed out or already a streamer (the page sends them on). */
export async function getStreamerGate(): Promise<StreamerGate | null> {
  if (!FLEXTV_STUDIO) throw new Error("Only with the FLEXTV backend.");
  const token = await getFlextvAccessToken();
  if (!token) return null;
  const status = readStreamerStatus(await fetchMemberProfile(token));
  return !status || status.kind === "STREAMER" ? null : status.kind;
}

export async function becomeStreamer(input: unknown): Promise<BecomeStreamerResult> {
  if (!FLEXTV_STUDIO) throw new Error("Only with the FLEXTV backend.");
  const session = await getSession();
  const token = session && (await getFlextvAccessToken());
  if (!session || !token) return { status: "UNAUTHORIZED" };
  if (hasRole(session, "CREATOR")) return { status: "ALREADY_CREATOR" };
  const agreed = typeof input === "object" && input !== null && (input as { agreed?: unknown }).agreed === true;
  if (!agreed) return { status: "INVALID", message: "방송 준수사항에 동의해 주세요." };

  const context = await requestDeviceContext();
  return serialize(session.userId, async () => {
    try {
      const before = readStreamerStatus(await fetchMemberProfile(token));
      if (!before) return { status: "UNAUTHORIZED" };
      if (before.kind === "STREAMER") return done();
      if (before.kind !== "ELIGIBLE") return { status: before.kind };

      const outcome = await registerStreamer(token, context);
      if (outcome.kind === "UNAUTHORIZED") return { status: "UNAUTHORIZED" };
      if (outcome.kind === "FOREIGNER") return { status: "FOREIGNER" };
      if (outcome.kind === "NOT_VERIFIED") return { status: "IDENTITY_REQUIRED" };
      if (outcome.kind === "REFUSED") return { status: "INVALID", message: "FLEXTV가 방송인 등록을 받지 않았어요. FLEXTV 고객센터에 문의해 주세요." };

      const after = readStreamerStatus(await fetchMemberProfile(token));
      return after?.kind === "STREAMER" ? done() : { status: "PENDING" };
    } catch (error) {
      if (error instanceof FlextvUnavailableError) return { status: "UNKNOWN" };
      throw error;
    }
  });
}

/** The session is read again on the next request, now with the Creator role. */
async function done(): Promise<BecomeStreamerResult> {
  await forgetFlextvSession();
  return { status: "REGISTERED" };
}
