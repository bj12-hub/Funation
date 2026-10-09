import { USE_MOCK } from "@/lib/mock";
import { customSoundFile } from "@/services/creator/customSoundCore";

/**
 * Mock CDN for 커스텀 사운드 audio (code-first), played by the 후원 알림 overlay. Like `/api/media/[id]`, the id is an
 * unguessable UUID; the bytes were type-checked on save. `no-store`: a sound saved again keeps its id.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!USE_MOCK) return new Response("Not found", { status: 404 });
  const file = customSoundFile((await params).id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.bytes.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
}
