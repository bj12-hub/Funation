import { USE_MOCK } from "@/lib/mock";
import { inputLive } from "@/services/play/rumbleLiveCore";

/**
 * 로얄 럼블 (조작형) controller — code-first mock (2026-10-24). A joined player's page posts its stick and attack here
 * several times a second: JSON `{ token, playerId, secret, dx, dy, attack }` (leave out dx/dy to only read). The answer is
 * the round and that player's fighter. The round token, player id and secret are the credentials (no cookies).
 */

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const BODY_MAX = 2000;

export async function POST(request: Request) {
  if (!USE_MOCK) return json(404, { status: "NOT_FOUND" });
  if (Number(request.headers.get("content-length") ?? 0) > BODY_MAX) return json(413, { status: "TOO_LARGE" });
  const raw = await request.text();
  if (raw.length > BODY_MAX) return json(413, { status: "TOO_LARGE" });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return json(400, { status: "BAD_REQUEST" });
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { status: "BAD_REQUEST" });
  }
  const me = inputLive({ token: body.token, playerId: body.playerId, secret: body.secret, dx: body.dx, dy: body.dy, attack: body.attack });
  return me ? json(200, { status: "OK", me }) : json(404, { status: "NOT_FOUND" });
}
