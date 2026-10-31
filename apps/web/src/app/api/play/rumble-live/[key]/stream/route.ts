import { USE_MOCK } from "@/lib/mock";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { overlaySignal } from "@/services/creator/alertCore";
import { liveState } from "@/services/play/rumbleLiveCore";
import { LIVE_STREAM_IDLE_MS, LIVE_STREAM_MS } from "@/services/play/rumbleLiveTypes";

/**
 * 로얄 럼블 (조작형) for OBS as a server push (Server-Sent Events, 2026-11-01) — code-first mock. Instead of the overlay asking
 * ten times a second, the server sends the battle on every tick while a round counts down or fights, and otherwise when it
 * changes or every LIVE_STREAM_IDLE_MS (so a dropped connection shows). The integration key in the path is the secret; a
 * key that stops being valid (재발급) ends the stream with `gone`. The overlay falls back to reading
 * `/api/play/rumble-live/[key]` when the stream cannot be opened.
 */

export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!USE_MOCK || !overlayKeyOpen(key)) return json(404, { status: "NOT_FOUND" });
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let last = "";
      let lastSent = 0;
      const stop = () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      const push = () => {
        if (!overlayKeyOpen(key)) {
          controller.enqueue(encoder.encode("event: gone\ndata: {}\n\n"));
          return stop();
        }
        const state = liveState(overlaySignal("play"));
        // The server clock changes on every read: compare the battle without it.
        const body = JSON.stringify({ ...state, serverNow: "" });
        const busy = state.phase === "FIGHTING" || state.phase === "COUNTDOWN";
        if (!busy && body === last && Date.now() - lastSent < LIVE_STREAM_IDLE_MS) return;
        last = body;
        lastSent = Date.now();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
      };
      push();
      timer = setInterval(push, LIVE_STREAM_MS);
      request.signal.addEventListener("abort", stop);
    },
    cancel() {
      clearInterval(timer);
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" }
  });
}
