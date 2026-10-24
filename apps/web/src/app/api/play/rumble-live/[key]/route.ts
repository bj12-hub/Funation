import { USE_MOCK } from "@/lib/mock";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { overlaySignal } from "@/services/creator/alertCore";
import { liveState } from "@/services/play/rumbleLiveCore";

/**
 * 로얄 럼블 (조작형) for OBS — code-first mock (2026-10-24). The overlay reads the battle here several times a second; the
 * integration key in the path is the secret (an unknown key looks like a missing page, as for the overlay pages).
 */

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!USE_MOCK || !overlayKeyOpen((await params).key)) return json(404, { status: "NOT_FOUND" });
  return json(200, liveState(overlaySignal("play")));
}
