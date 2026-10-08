import { USE_MOCK } from "@/lib/mock";
import { findAsset } from "@/services/creator/assetCore";

/**
 * Mock CDN for 이미지·사운드 library files (code-first). The id is an unguessable UUID, like a CDN key;
 * the bytes were type-checked on upload and are served with their sniffed type and `nosniff`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!USE_MOCK) return new Response("Not found", { status: 404 });
  const asset = findAsset((await params).id);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
}
